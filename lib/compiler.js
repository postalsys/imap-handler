'use strict';

const { isUtf8 } = require('buffer');
const formalSyntax = require('./formal');

// RFC 3501 9: a quoted string holds TEXT-CHARs (7-bit, no NUL, CR or LF), anything else needs a literal
// eslint-disable-next-line no-control-regex
const NEEDS_LITERAL = /[\x00\r\n\x80-\uffff]/;

// A line break or NUL would end or corrupt the command, so values written as is must not contain one.
// Output is written as a binary string, where chars above 0xFF lose their high byte (U+010A becomes LF).
// eslint-disable-next-line no-control-regex
const UNSAFE_TEXT = /[\x00\r\n\u0100-\uffff]/;

const isAtom = value => {
    for (let i = 0, len = value.length; i < len; i++) {
        if (!formalSyntax.isAtomChar(value.charAt(i))) {
            return false;
        }
    }
    return !!value.length;
};

// RFC 3501 9: flag = "\" atom, and flag-perm also allows "\*"
const isFlagOrAtom = value => value === '\\*' || isAtom(value.charAt(0) === '\\' ? value.slice(1) : value);

// RFC 3501 9: sequence-set, plus "$" from RFC 5182
const isSequenceSet = value => value === '$' || formalSyntax.isSequenceSet(value);

// Only bounded non-negative integers are written, anything else becomes 0
const toNumber = value => {
    const num = Math.round(Number(value));
    return Number.isSafeInteger(num) && num >= 0 ? num : 0;
};

// Values are binary strings (one char per octet), Buffers are converted to the same form
const toBinaryString = value => {
    if (Buffer.isBuffer(value)) {
        return value.toString('binary');
    }
    return value === null || value === undefined ? '' : value.toString();
};

const literal = value => '{' + value.length + '}\r\n' + value;

// RFC 3501 9: only DQUOTE and "\" are escaped in a quoted string
const quote = value => '"' + value.replace(/["\\]/g, '\\$&') + '"';

// RFC 3516 4.3 and RFC 9051 9: literal8 = "~{" number64 "}" CRLF *OCTET
const literal8 = value => '~' + literal(value);

const encodeAsciiString = value => (NEEDS_LITERAL.test(value) ? literal(value) : quote(value));

// RFC 9051 9 and RFC 9755 3: QUOTED-CHAR may also be UTF8-2 / UTF8-3 / UTF8-4, so a binary string
// that is valid UTF-8 (RFC 3629 4) can be quoted as long as it has no NUL, CR, LF or chars above 0xFF
const encodeUtf8String = value =>
    !NEEDS_LITERAL.test(value) || (!UNSAFE_TEXT.test(value) && isUtf8(Buffer.from(value, 'binary'))) ? quote(value) : literal(value);

const compilerError = (message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const checkText = (value, what) => {
    if (UNSAFE_TEXT.test(value)) {
        throw compilerError('Line break or NUL in ' + what, 'InvalidTextValue');
    }
    return value;
};

/**
 * Compiles an input object into an IMAP string
 *
 * @param {Object} response Object with tag, command and attributes
 * @param {Object} [options] Set utf8 to write valid UTF-8 values as quoted strings instead of literals
 */
module.exports = function (response, options) {
    const encodeString = options && options.utf8 ? encodeUtf8String : encodeAsciiString;
    let resp = checkText(toBinaryString(response.tag), 'tag') + (response.command ? ' ' + checkText(toBinaryString(response.command), 'command') : '');
    // set right after "(" or "[" is written, so the first element inside gets no leading space
    let afterOpener = false;

    const walk = function (node) {
        if (!afterOpener) {
            resp += ' ';
        }
        afterOpener = false;

        if (Array.isArray(node)) {
            resp += '(';
            afterOpener = true;
            // some rules start with lists that have no SP between them, e.g.
            // body-type-mpart = 1*body SP media-subtype and env-from = "(" 1*address ")" (RFC 3501 section 9)
            let leadingLists = 0;
            if (node.adjacentLists) {
                while (leadingLists < node.length && Array.isArray(node[leadingLists])) {
                    leadingLists++;
                }
            }
            node.forEach((child, i) => {
                if (i && i < leadingLists) {
                    afterOpener = true;
                }
                walk(child);
            });
            resp += ')';
            afterOpener = false;
            return;
        }

        if (Buffer.isBuffer(node)) {
            resp += encodeString(toBinaryString(node));
            return;
        }

        if (!node && typeof node !== 'string' && typeof node !== 'number') {
            resp += 'NIL';
            return;
        }

        if (typeof node === 'string') {
            resp += encodeString(node);
            return;
        }

        if (typeof node === 'number') {
            resp += toNumber(node); // Only integers allowed
            return;
        }

        let val;

        switch (typeof node.type === 'string' ? node.type.toUpperCase() : '') {
            case 'LITERAL':
                resp += literal(toBinaryString(node.value));
                break;

            case 'LITERAL8':
                resp += literal8(toBinaryString(node.value));
                break;

            case 'STRING':
                resp += encodeString(toBinaryString(node.value));
                break;

            case 'TEXT':
                resp += checkText(toBinaryString(node.value), 'TEXT value');
                break;

            case 'SEQUENCE':
                val = toBinaryString(node.value);
                if (!isSequenceSet(val)) {
                    throw compilerError('Invalid sequence set', 'InvalidSequenceSet');
                }
                resp += val;
                break;

            case 'NUMBER':
                resp += toNumber(node.value);
                break;

            case 'ATOM':
            case 'SECTION':
                val = toBinaryString(node.value);

                // an empty value only carries a section, as in [ALERT]
                if (val || !node.section) {
                    resp += isFlagOrAtom(val) ? val : encodeString(val);
                }

                if (node.section) {
                    resp += '[';
                    afterOpener = true;
                    node.section.forEach(walk);
                    resp += ']';
                    afterOpener = false;
                }
                if (node.partial) {
                    resp += '<' + [].concat(node.partial).map(toNumber).join('.') + '>';
                }
                break;

            default:
                throw compilerError('Unknown node type ' + JSON.stringify(node.type), 'InvalidNodeType');
        }
    };

    [].concat(response.attributes || []).forEach(walk);

    return resp;
};

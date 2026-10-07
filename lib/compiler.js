'use strict';

const formalSyntax = require('./formal');

// RFC 3501 9: a quoted string holds TEXT-CHARs (7-bit, no NUL, CR or LF), anything else needs a literal
// eslint-disable-next-line no-control-regex
const NEEDS_LITERAL = /[\x00\r\n\x80-\uffff]/;

// A line break or NUL would end or corrupt the command, so values written as is must not contain one
// eslint-disable-next-line no-control-regex
const UNSAFE_TEXT = /[\x00\r\n]/;

// RFC 3501 9: one element of a sequence-set, checked per element so the cost stays linear
const SEQ_RANGE = /^(?:\d+|\*)(?::(?:\d+|\*))?$/;

let atomChars;
const isAtom = value => {
    if (!atomChars) {
        atomChars = new Set(formalSyntax['ATOM-CHAR']());
    }
    for (let i = 0, len = value.length; i < len; i++) {
        if (!atomChars.has(value.charAt(i))) {
            return false;
        }
    }
    return !!value.length;
};

// RFC 3501 9: flag = "\" atom, and flag-perm also allows "\*"
const isFlagOrAtom = value => value === '\\*' || isAtom(value.charAt(0) === '\\' ? value.slice(1) : value);

// RFC 3501 9: sequence-set, plus "$" from RFC 5182
const isSequenceSet = value => value === '$' || (!!value && value.split(',').every(part => SEQ_RANGE.test(part)));

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

const encodeString = value => (NEEDS_LITERAL.test(value) ? literal(value) : quote(value));

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
 */
module.exports = function (response) {
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
            node.forEach(walk);
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

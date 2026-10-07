'use strict';

const formalSyntax = require('./formal');

// RFC 3501 9: number is an unsigned 32-bit integer
const MAX_NUMBER = 0xffffffff;

// Deeper input (lists, sections and the values in them) is refused instead of risking the stack
const MAX_NODE_DEPTH = 25;

// RFC 3501 9: one element of a sequence-set, seq-number / seq-range. Checked per element so the
// cost stays linear for very long sets.
const SEQ_RANGE = /^(?:\d+|\*)(?::(?:\d+|\*))?$/;

let atomChars;
const isAtomChar = chr => {
    if (!atomChars) {
        atomChars = new Set(formalSyntax['ATOM-CHAR']());
    }
    return atomChars.has(chr);
};

const isDigit = code => code >= 0x30 && code <= 0x39;

const isSequenceSet = value => value.split(',').every(part => SEQ_RANGE.test(part));

const parserError = (message, pos, code) => {
    const error = new Error(message + ' at position ' + pos);
    error.code = code || 'ParserError';
    error.pos = pos;
    return error;
};

module.exports = function (command, options) {
    const response = {};

    // work on a copy, the caller's object is left as it was
    options = Object.assign({}, options);
    options.allowSection = options.allowSection || ['BODY', 'BODY.PEEK'];
    options.multiWords = options.multiWords || ['UID', 'AUTHENTICATE'];
    options.allowUntagged = !!options.allowUntagged;

    const parser = new ParserInstance(command, options);

    response.tag = parser.getTag();
    parser.getSpace();
    response.command = parser.getCommand();

    if (options.multiWords.indexOf((response.command || '').toUpperCase()) >= 0) {
        parser.getSpace();
        response.command += ' ' + parser.getElement(formalSyntax.command());
    }

    if (parser.remainder.length) {
        parser.getSpace();
        response.attributes = parser.getAttributes();
    }

    return response;
};

function ParserInstance(input, options) {
    this.input = (input || '').toString();
    this.options = options || {};
    this.remainder = this.input;
    this.pos = 0;
}

ParserInstance.prototype.getTag = function () {
    if (!this.tag) {
        this.tag = this.getElement(formalSyntax.tag() + (this.options.allowUntagged ? '*' : ''), true);
    }
    return this.tag;
};

ParserInstance.prototype.getCommand = function () {
    if (!this.command) {
        this.command = this.getElement(formalSyntax.command());
    }
    return this.command;
};

ParserInstance.prototype.getElement = function (syntax) {
    let match;
    let element;
    let errPos;
    if (this.remainder.match(/^\s/)) {
        throw parserError('Unexpected whitespace', this.pos);
    }

    if ((match = this.remainder.match(/^[^\s]+(?=\s|$)/))) {
        element = match[0];

        if ((errPos = formalSyntax.verify(element, syntax)) >= 0) {
            throw parserError('Unexpected char', this.pos + errPos);
        }
    } else {
        throw parserError('Unexpected end of input', this.pos);
    }

    this.pos += match[0].length;
    this.remainder = this.remainder.substr(match[0].length);

    return element;
};

ParserInstance.prototype.getSpace = function () {
    if (!this.remainder.length) {
        throw parserError('Unexpected end of input', this.pos);
    }

    if (formalSyntax.verify(this.remainder.charAt(0), formalSyntax.SP()) >= 0) {
        throw parserError('Unexpected char', this.pos);
    }

    this.pos++;
    this.remainder = this.remainder.substr(1);
};

ParserInstance.prototype.getAttributes = function () {
    if (!this.remainder.length) {
        throw parserError('Unexpected end of input', this.pos);
    }

    if (this.remainder.match(/^\s/)) {
        throw parserError('Unexpected whitespace', this.pos);
    }

    return new TokenParser(this.pos, this.remainder, this.options).getAttributes();
};

function TokenParser(startPos, str, options) {
    this.str = (str || '').toString();
    this.options = options || {};
    this.pos = startPos || 0;

    // the longest value that may open a section, longer atoms are not compared at all
    this.maxSectionName = Math.max(0, ...this.options.allowSection.map(name => name.length));
    // index of a "<" that directly follows a closed section and so starts a partial
    this.partialAt = -1;

    this.tree = this.currentNode = this.createNode();
    this.currentNode.type = 'TREE';

    this.processString();
}

TokenParser.prototype.getAttributes = function () {
    const attributes = [];
    let branch = attributes;

    const walk = node => {
        let elm;
        const curBranch = branch;

        // If the node was never closed, throw it
        if (!node.closed) {
            throw parserError('Unexpected end of input', this.pos + this.str.length);
        }

        switch (node.type) {
            case 'LITERAL':
            case 'STRING':
            case 'SEQUENCE':
                elm = {
                    type: node.type,
                    value: node.value
                };
                branch.push(elm);
                break;
            case 'ATOM':
                if (node.value.toUpperCase() === 'NIL') {
                    branch.push(null);
                    break;
                }
                elm = {
                    type: node.type,
                    value: node.value
                };
                branch.push(elm);
                break;
            case 'SECTION':
                branch = branch[branch.length - 1].section = [];
                break;
            case 'LIST':
                elm = [];
                branch.push(elm);
                branch = elm;
                break;
            case 'PARTIAL':
                branch[branch.length - 1].partial = node.value.split('.').map(Number);
                break;
        }

        node.childNodes.forEach(walk);
        branch = curBranch;
    };

    walk(this.tree);

    return attributes;
};

TokenParser.prototype.createNode = function (parentNode, startPos) {
    const node = {
        childNodes: [],
        type: false,
        value: '',
        closed: true,
        depth: parentNode ? parentNode.depth + 1 : 0
    };

    if (node.depth > MAX_NODE_DEPTH) {
        throw parserError('Too much nesting', startPos, 'MaxNestingReached');
    }

    if (parentNode) {
        node.parentNode = parentNode;
        parentNode.childNodes.push(node);
    }

    if (typeof startPos === 'number') {
        node.startPos = startPos;
    }

    return node;
};

// Adds a complete value node to the current list, section or tree
TokenParser.prototype.addValue = function (type, value, start, end) {
    const node = this.createNode(this.currentNode, this.pos + start);
    node.type = type;
    node.value = value;
    node.endPos = this.pos + end - 1;
    return node;
};

/**
 * Checks what follows a value or a closed list or section and returns the index to continue from.
 * A single space separates values, otherwise the next char must close the enclosing list or section.
 */
TokenParser.prototype.afterValue = function (i, allowPartial) {
    const str = this.str;

    if (i >= str.length) {
        return i;
    }

    const chr = str.charAt(i);

    if (chr === ' ') {
        const next = str.charAt(i + 1);
        if (i + 1 >= str.length || next === ' ' || next === ')' || (next === ']' && this.currentNode.type === 'SECTION')) {
            throw parserError('Unexpected whitespace', this.pos + i);
        }
        return i + 1;
    }

    if ((chr === ')' && this.currentNode.type === 'LIST') || (chr === ']' && this.currentNode.type === 'SECTION')) {
        return i;
    }

    if (chr === '<' && allowPartial) {
        this.partialAt = i;
        return i;
    }

    throw parserError('Unexpected char', this.pos + i);
};

TokenParser.prototype.processString = function () {
    const str = this.str;
    const len = str.length;
    let i = 0;

    while (i < len) {
        switch (str.charAt(i)) {
            // normally a space should never occur here
            case ' ':
                throw parserError('Unexpected whitespace', this.pos + i);

            // DQUOTE starts a new string
            case '"':
                i = this.readString(i);
                break;

            // ( starts a new list
            case '(':
                this.currentNode = this.createNode(this.currentNode, this.pos + i);
                this.currentNode.type = 'LIST';
                this.currentNode.closed = false;
                i++;
                break;

            // ) closes a list
            case ')':
                if (this.currentNode.type !== 'LIST') {
                    throw parserError('Unexpected list terminator )', this.pos + i);
                }
                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;
                i = this.afterValue(i + 1);
                break;

            // ] closes a section, otherwise it is a valid first char of an astring (RFC 3501 9)
            case ']':
                if (this.currentNode.type !== 'SECTION') {
                    i = this.readAtom(i);
                    break;
                }
                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;
                i = this.afterValue(i + 1, true);
                break;

            // { starts a new literal
            case '{':
                i = this.readLiteral(i);
                break;

            // < starts a partial right after a section, otherwise it is an ATOM-CHAR
            case '<':
                i = i === this.partialAt ? this.readPartial(i) : this.readAtom(i);
                break;

            default:
                i = this.readAtom(i);
                break;
        }
    }
};

/**
 * Reads an atom or a sequence set starting at i. Both are made of the same chars, so the type is
 * decided once the whole token is known: a token of only digits, ":", "," and "*" is a sequence
 * set (a lone number or "*" stays an ATOM), anything else is an atom.
 */
TokenParser.prototype.readAtom = function (start) {
    const str = this.str;
    const len = str.length;
    const parentType = this.currentNode.type;
    let seqOnly = true;
    let digitsOnly = true;
    let i;

    for (i = start; i < len; i++) {
        const chr = str.charAt(i);
        const code = str.charCodeAt(i);

        if (chr === ' ' || (chr === ')' && parentType === 'LIST') || (chr === ']' && parentType === 'SECTION')) {
            break;
        }

        // [ starts a section group for the allowed elements, otherwise it is an ATOM-CHAR
        if (chr === '[' && i > start && i - start <= this.maxSectionName && this.options.allowSection.indexOf(str.slice(start, i).toUpperCase()) >= 0) {
            this.addValue('ATOM', str.slice(start, i), start, i);
            this.currentNode = this.createNode(this.currentNode, this.pos + i);
            this.currentNode.type = 'SECTION';
            this.currentNode.closed = false;
            return i + 1;
        }

        // Allow \ as the first char for system flags, list-wildcards for LIST patterns and
        // ] as an astring char (RFC 3501 9)
        if (!isAtomChar(chr) && chr !== '%' && chr !== '*' && chr !== ']' && !(chr === '\\' && i === start)) {
            throw parserError('Unexpected char', this.pos + i);
        }

        if (!isDigit(code)) {
            digitsOnly = false;
            if (chr !== ':' && chr !== ',' && chr !== '*') {
                seqOnly = false;
            }
        }
    }

    if (i === start) {
        throw parserError('Unexpected char', this.pos + i);
    }

    const value = str.slice(start, i);
    let type = 'ATOM';

    if (seqOnly && !digitsOnly && value !== '*') {
        if (!isSequenceSet(value)) {
            throw parserError('Invalid sequence set', this.pos + start);
        }
        type = 'SEQUENCE';
    }

    this.addValue(type, value, start, i);
    return this.afterValue(i);
};

// RFC 3501 9: quoted = DQUOTE *QUOTED-CHAR DQUOTE, only DQUOTE and "\" may be escaped
TokenParser.prototype.readString = function (start) {
    const str = this.str;
    const len = str.length;
    let value = '';
    let chunkStart = start + 1;

    for (let i = start + 1; i < len; i++) {
        const code = str.charCodeAt(i);

        if (code === 0x22) {
            value += str.slice(chunkStart, i);
            this.addValue('STRING', value, start, i + 1);
            return this.afterValue(i + 1);
        }

        if (code === 0x5c) {
            if (i + 1 >= len) {
                throw parserError('Unexpected end of input', this.pos + i + 1);
            }
            const next = str.charAt(i + 1);
            if (next !== '"' && next !== '\\') {
                throw parserError('Unexpected escaped char', this.pos + i + 1);
            }
            value += str.slice(chunkStart, i) + next;
            i++;
            chunkStart = i + 1;
            continue;
        }

        // TEXT-CHAR is any 7-bit char except NUL, CR and LF
        if (code === 0x00 || code === 0x0a || code === 0x0d || code > 0x7f) {
            throw parserError('Unexpected char', this.pos + i);
        }
    }

    throw parserError('Unexpected end of input', this.pos + len);
};

// RFC 3501 9: literal = "{" number "}" CRLF *CHAR8, RFC 7888 adds "{" number "+}" for LITERAL+
TokenParser.prototype.readLiteral = function (start) {
    const str = this.str;
    const len = str.length;
    let i = start + 1;

    while (i < len && isDigit(str.charCodeAt(i))) {
        i++;
    }

    if (i === start + 1) {
        throw parserError(i >= len ? 'Unexpected end of input' : 'Unexpected char', this.pos + i);
    }

    const size = Number(str.slice(start + 1, i));

    if (str.charAt(i) === '+' && this.options.literalPlus) {
        i++;
    }

    if (str.charAt(i) !== '}') {
        throw parserError(i >= len ? 'Unexpected end of input' : 'Unexpected char', this.pos + i);
    }
    i++;

    if (str.charAt(i) === '\n') {
        i++;
    } else if (str.charAt(i) === '\r' && str.charAt(i + 1) === '\n') {
        i += 2;
    } else {
        throw parserError(i >= len ? 'Unexpected end of input' : 'Unexpected char', this.pos + i);
    }

    if (size > MAX_NUMBER || i + size > len) {
        throw parserError('Unexpected end of input', this.pos + len);
    }

    const value = str.substr(i, size);

    // CHAR8 excludes NUL
    const nulPos = value.indexOf('\x00');
    if (nulPos >= 0) {
        throw parserError('Unexpected \\x00', this.pos + i + nulPos);
    }

    this.addValue('LITERAL', value, start, i + size);
    return this.afterValue(i + size);
};

// RFC 3501 9: partial = "<" number "." nz-number ">", a single number is also accepted
TokenParser.prototype.readPartial = function (start) {
    const str = this.str;
    const len = str.length;
    let i = start + 1;

    const readNumber = nonZero => {
        const numStart = i;
        while (i < len && isDigit(str.charCodeAt(i))) {
            i++;
        }
        if (i === numStart) {
            throw parserError(i >= len ? 'Unexpected end of input' : 'Unexpected char', this.pos + i);
        }
        if (nonZero && str.charAt(numStart) === '0') {
            throw parserError('Invalid partial', this.pos + numStart);
        }
        if (Number(str.slice(numStart, i)) > MAX_NUMBER) {
            throw parserError('Invalid partial', this.pos + numStart);
        }
    };

    readNumber(false);

    if (str.charAt(i) === '.') {
        i++;
        readNumber(true);
    }

    if (str.charAt(i) !== '>') {
        throw parserError(i >= len ? 'Unexpected end of input' : 'Unexpected char', this.pos + i);
    }

    this.addValue('PARTIAL', str.slice(start + 1, i), start, i + 1);
    return this.afterValue(i + 1);
};

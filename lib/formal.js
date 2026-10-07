'use strict';

module.exports = {
    CHAR: function () {
        const value = this._expandRange(0x01, 0x7f);
        this.CHAR = function () {
            return value;
        };
        return value;
    },
    CHAR8: function () {
        const value = this._expandRange(0x01, 0xff);
        this.CHAR8 = function () {
            return value;
        };
        return value;
    },
    SP: function () {
        return ' ';
    },
    CTL: function () {
        const value = this._expandRange(0x00, 0x1f) + '\x7F';
        this.CTL = function () {
            return value;
        };
        return value;
    },
    DQUOTE: function () {
        return '"';
    },
    ALPHA: function () {
        const value = this._expandRange(0x41, 0x5a) + this._expandRange(0x61, 0x7a);
        this.ALPHA = function () {
            return value;
        };
        return value;
    },
    DIGIT: function () {
        const value = this._expandRange(0x30, 0x39);
        this.DIGIT = function () {
            return value;
        };
        return value;
    },
    'ATOM-CHAR': function () {
        const value = this._excludeChars(this.CHAR(), this['atom-specials']());
        this['ATOM-CHAR'] = function () {
            return value;
        };
        return value;
    },
    'ASTRING-CHAR': function () {
        const value = this['ATOM-CHAR']() + this['resp-specials']();
        this['ASTRING-CHAR'] = function () {
            return value;
        };
        return value;
    },
    'TEXT-CHAR': function () {
        const value = this._excludeChars(this.CHAR(), '\r\n');
        this['TEXT-CHAR'] = function () {
            return value;
        };
        return value;
    },
    'atom-specials': function () {
        const value = '(' + ')' + '{' + this.SP() + this.CTL() + this['list-wildcards']() + this['quoted-specials']() + this['resp-specials']();
        this['atom-specials'] = function () {
            return value;
        };
        return value;
    },
    'list-wildcards': function () {
        return '%' + '*';
    },
    'quoted-specials': function () {
        const value = this.DQUOTE() + '\\';
        this['quoted-specials'] = function () {
            return value;
        };
        return value;
    },
    'resp-specials': function () {
        return ']';
    },

    tag: function () {
        return this._excludeChars(this['ASTRING-CHAR'](), '+');
    },

    // RFC 3501 9: command names are atoms, e.g. x-command = "X" atom, and the second word of
    // UID and AUTHENTICATE is an atom too (auth-type = atom)
    command: function () {
        const value = this['ATOM-CHAR']();
        this.command = function () {
            return value;
        };
        return value;
    },

    _expandRange: function (start, end) {
        const chars = [];
        for (let i = start; i <= end; i++) {
            chars.push(i);
        }
        return String.fromCharCode.apply(String, chars);
    },

    _excludeChars: function (source, exclude) {
        const sourceArr = Array.prototype.slice.call(source);
        for (let i = sourceArr.length - 1; i >= 0; i--) {
            if (exclude.indexOf(sourceArr[i]) >= 0) {
                sourceArr.splice(i, 1);
            }
        }
        return sourceArr.join('');
    },

    /**
     * Checks a single character against ATOM-CHAR
     *
     * @param {String} chr Character to check
     * @return {Boolean} true if the character may appear in an atom
     */
    isAtomChar: function (chr) {
        if (!this._atomChars) {
            this._atomChars = new Set(this['ATOM-CHAR']());
        }
        return this._atomChars.has(chr);
    },

    /**
     * Checks a value against the sequence-set rule (RFC 3501 section 9). Each element is
     * checked on its own, so the cost stays linear for very long sets.
     *
     * @param {String} value Value to check
     * @return {Boolean} true for a valid sequence set
     */
    isSequenceSet: function (value) {
        return !!value && value.split(',').every(part => /^(?:\d+|\*)(?::(?:\d+|\*))?$/.test(part));
    },

    verify: function (str, allowedChars) {
        for (let i = 0, len = str.length; i < len; i++) {
            if (allowedChars.indexOf(str.charAt(i)) < 0) {
                return i;
            }
        }
        return -1;
    }
};

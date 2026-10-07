// RFC 3501 section 9 character classes. Each class is computed on first use and then reused.

export interface FormalSyntax {
    CHAR(): string;
    CHAR8(): string;
    SP(): string;
    CTL(): string;
    DQUOTE(): string;
    ALPHA(): string;
    DIGIT(): string;
    'ATOM-CHAR'(): string;
    'ASTRING-CHAR'(): string;
    'TEXT-CHAR'(): string;
    'atom-specials'(): string;
    'list-wildcards'(): string;
    'quoted-specials'(): string;
    'resp-specials'(): string;
    tag(): string;
    command(): string;
    _expandRange(start: number, end: number): string;
    _excludeChars(source: string, exclude: string): string;
    isAtomChar(chr: string): boolean;
    isSequenceSet(value: string): boolean;
    verify(str: string, allowedChars: string): number;
}

const memoize = <T>(fn: () => T): (() => T) => {
    let value: T | undefined;
    return () => {
        if (value === undefined) {
            value = fn();
        }
        return value;
    };
};

const expandRange = (start: number, end: number): string => {
    const chars: number[] = [];
    for (let i = start; i <= end; i++) {
        chars.push(i);
    }
    return String.fromCharCode(...chars);
};

const excludeChars = (source: string, exclude: string): string =>
    Array.from(source)
        .filter(chr => !exclude.includes(chr))
        .join('');

const atomChars = memoize(() => new Set(formal['ATOM-CHAR']()));

const formal: FormalSyntax = {
    CHAR: memoize(() => expandRange(0x01, 0x7f)),
    CHAR8: memoize(() => expandRange(0x01, 0xff)),
    SP: () => ' ',
    CTL: memoize(() => expandRange(0x00, 0x1f) + '\x7F'),
    DQUOTE: () => '"',
    ALPHA: memoize(() => expandRange(0x41, 0x5a) + expandRange(0x61, 0x7a)),
    DIGIT: memoize(() => expandRange(0x30, 0x39)),
    'ATOM-CHAR': memoize(() => excludeChars(formal.CHAR(), formal['atom-specials']())),
    'ASTRING-CHAR': memoize(() => formal['ATOM-CHAR']() + formal['resp-specials']()),
    'TEXT-CHAR': memoize(() => excludeChars(formal.CHAR(), '\r\n')),
    'atom-specials': memoize(
        () => '(' + ')' + '{' + formal.SP() + formal.CTL() + formal['list-wildcards']() + formal['quoted-specials']() + formal['resp-specials']()
    ),
    'list-wildcards': () => '%' + '*',
    'quoted-specials': () => formal.DQUOTE() + '\\',
    'resp-specials': () => ']',

    tag: memoize(() => excludeChars(formal['ASTRING-CHAR'](), '+')),

    // RFC 3501 9: command names are atoms, e.g. x-command = "X" atom, and the second word of
    // UID and AUTHENTICATE is an atom too (auth-type = atom)
    command: memoize(() => formal['ATOM-CHAR']()),

    _expandRange: expandRange,

    _excludeChars: excludeChars,

    /**
     * Checks a single character against ATOM-CHAR
     *
     * @param chr Character to check
     * @return true if the character may appear in an atom
     */
    isAtomChar(chr: string): boolean {
        return atomChars().has(chr);
    },

    /**
     * Checks a value against the sequence-set rule (RFC 3501 section 9). Each element is
     * checked on its own, so the cost stays linear for very long sets.
     *
     * @param value Value to check
     * @return true for a valid sequence set
     */
    isSequenceSet(value: string): boolean {
        return !!value && value.split(',').every(part => /^(?:\d+|\*)(?::(?:\d+|\*))?$/.test(part));
    },

    /**
     * Returns the position of the first char of str that is not in allowedChars, or -1
     */
    verify(str: string, allowedChars: string): number {
        for (let i = 0, len = str.length; i < len; i++) {
            if (allowedChars.indexOf(str.charAt(i)) < 0) {
                return i;
            }
        }
        return -1;
    }
};

export default formal;

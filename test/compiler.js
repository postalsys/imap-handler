'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { parser, compiler } = require('../index');

it('Test compiler', () => {
    const command =
        '* FETCH (ENVELOPE ("Mon, 2 Sep 2013 05:30:13 -0700 (PDT)" NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "tr.ee")) NIL NIL NIL "<-4730417346358914070@unknownmsgid>") BODYSTRUCTURE (("MESSAGE" "RFC822" NIL NIL NIL "7BIT" 105 (NIL NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "pangalink.net")) NIL NIL "<test1>" NIL) ("TEXT" "PLAIN" NIL NIL NIL "7BIT" 12 0 NIL NIL NIL) 5 NIL NIL NIL) ("MESSAGE" "RFC822" NIL NIL NIL "7BIT" 83 (NIL NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "pangalink.net")) NIL NIL "NIL" NIL) ("TEXT" "PLAIN" NIL NIL NIL "7BIT" 12 0 NIL NIL NIL) 4 NIL NIL NIL) ("TEXT" "HTML" ("CHARSET" "utf-8") NIL NIL "QUOTED-PRINTABLE" 19 0 NIL NIL NIL) "MIXED" ("BOUNDARY" "----mailcomposer-?=_1-1328088797399") NIL NIL))';
    const parsed = parser(command, {
        allowUntagged: true
    });
    const compiled = compiler(parsed);

    assert.equal(command, compiled);
});

describe('Test Types', () => {
    it('No attributes', () => {
        const parsed = {
            tag: '*',
            command: 'CMD'
        };
        const compiled = compiler(parsed);

        assert.equal('* CMD', compiled);
    });

    it('TEXT', () => {
        const parsed = {
            tag: '*',
            command: 'CMD',
            attributes: [
                {
                    type: 'TEXT',
                    value: 'Tere tere!'
                }
            ]
        };
        const compiled = compiler(parsed);

        assert.equal('* CMD Tere tere!', compiled);
    });

    it('SECTION', () => {
        const parsed = {
            tag: '*',
            command: 'CMD',
            attributes: [
                {
                    type: 'SECTION',
                    section: [
                        {
                            type: 'ATOM',
                            value: 'ALERT'
                        }
                    ]
                }
            ]
        };
        const compiled = compiler(parsed);

        assert.equal('* CMD [ALERT]', compiled);
    });

    it('ATOM', () => {
        const parsed = {
            tag: '*',
            command: 'CMD',
            attributes: [
                {
                    type: 'ATOM',
                    value: 'ALERT'
                },
                {
                    type: 'ATOM',
                    value: '\\ALERT'
                },
                {
                    type: 'ATOM',
                    value: 'NO ALERT'
                }
            ]
        };
        const compiled = compiler(parsed);
        assert.equal('* CMD ALERT \\ALERT "NO ALERT"', compiled);
    });

    it('SEQUENCE', () => {
        const parsed = {
            tag: '*',
            command: 'CMD',
            attributes: [
                {
                    type: 'SEQUENCE',
                    value: '*:4,5,6'
                }
            ]
        };
        const compiled = compiler(parsed);

        assert.equal('* CMD *:4,5,6', compiled);
    });

    it('NIL', () => {
        const parsed = {
            tag: '*',
            command: 'CMD',
            attributes: [null, null]
        };
        const compiled = compiler(parsed);

        assert.equal('* CMD NIL NIL', compiled);
    });

    it('TEXT 2', () => {
        const parsed = {
            tag: '*',
            command: 'CMD',
            attributes: [
                {
                    type: 'String',
                    value: 'Tere tere!'
                },
                'Vana kere'
            ]
        };
        const compiled = compiler(parsed);

        assert.equal('* CMD "Tere tere!" "Vana kere"', compiled);
    });

    it('No Command', () => {
        const parsed = {
            tag: '*',
            attributes: [
                1,
                {
                    type: 'ATOM',
                    value: 'EXPUNGE'
                }
            ]
        };
        const compiled = compiler(parsed);

        assert.equal('* 1 EXPUNGE', compiled);
    });
});

describe('Quoting and literals', () => {
    const compile = attributes => compiler({ tag: '*', command: 'CMD', attributes });

    it('escapes only DQUOTE and backslash', () => {
        assert.equal(compile(['a\tb', 'x"y\\z', { type: 'STRING', value: '' }]), '* CMD "a\tb" "x\\"y\\\\z" ""');
    });

    it('uses a literal for CR, LF, NUL and 8-bit values', () => {
        assert.equal(compile(['a\r\nb']), '* CMD {4}\r\na\r\nb');
        assert.equal(compile([{ type: 'STRING', value: 'a\x00b' }]), '* CMD {3}\r\na\x00b');
        // binary string, one char per octet
        assert.equal(compile(['\xc3\xa9', 'next']), '* CMD {2}\r\n\xc3\xa9 "next"');
    });

    it('accepts Buffer values', () => {
        assert.equal(compile([{ type: 'LITERAL', value: Buffer.from('é') }]), '* CMD {2}\r\n\xc3\xa9');
        assert.equal(compile([Buffer.from('abc')]), '* CMD "abc"');
        assert.equal(compile([{ type: 'LITERAL', value: '' }, { type: 'LITERAL' }]), '* CMD {0}\r\n {0}\r\n');
    });

    it('separates a literal ending in an opening bracket from the next value', () => {
        assert.equal(compile([[{ type: 'LITERAL', value: 'a(' }, 'b']]), '* CMD ({2}\r\na( "b")');
    });
});

describe('Atoms', () => {
    const compile = attributes => compiler({ tag: '*', command: 'CMD', attributes });

    it('writes flags as atoms', () => {
        assert.equal(
            compile([
                [
                    { type: 'ATOM', value: '\\Seen' },
                    { type: 'ATOM', value: '\\*' },
                    { type: 'ATOM', value: '$Label' }
                ]
            ]),
            '* CMD (\\Seen \\* $Label)'
        );
    });

    it('quotes values that are not atoms', () => {
        assert.equal(
            compile([
                { type: 'ATOM', value: 'a b' },
                { type: 'ATOM', value: 'a"b' }
            ]),
            '* CMD "a b" "a\\"b"'
        );
        assert.equal(compile([{ type: 'ATOM', value: 'a\r\nb' }]), '* CMD {4}\r\na\r\nb');
    });

    it('writes an empty atom as an empty string', () => {
        assert.equal(
            compile([
                { type: 'ATOM', value: '' },
                { type: 'ATOM', value: 'X' }
            ]),
            '* CMD "" X'
        );
        assert.equal(compile([{ type: 'SECTION', section: [{ type: 'ATOM', value: 'ALERT' }] }]), '* CMD [ALERT]');
    });

    it('writes sections and partials', () => {
        assert.equal(compile([{ type: 'ATOM', value: 'BODY', section: [], partial: [0, 10] }]), '* CMD BODY[]<0.10>');
        assert.equal(compile([{ type: 'ATOM', value: 'BODY', section: [], partial: ['x\r\n', 2] }]), '* CMD BODY[]<0.2>');
    });
});

describe('Unchecked values', () => {
    const compile = attributes => compiler({ tag: '*', command: 'CMD', attributes });

    it('validates sequence sets', () => {
        assert.equal(
            compile([
                { type: 'SEQUENCE', value: '1:*,5,*' },
                { type: 'SEQUENCE', value: '$' }
            ]),
            '* CMD 1:*,5,* $'
        );
        assert.throws(() => compile([{ type: 'SEQUENCE', value: '1\r\nA2 LOGOUT' }]), { code: 'InvalidSequenceSet' });
        assert.throws(() => compile([{ type: 'SEQUENCE', value: '' }]), { code: 'InvalidSequenceSet' });
    });

    it('refuses line breaks in TEXT, tag and command', () => {
        assert.throws(() => compile([{ type: 'TEXT', value: 'a\r\nA2 LOGOUT' }]), { code: 'InvalidTextValue' });
        assert.throws(() => compiler({ tag: '*\r\n', command: 'OK' }), { code: 'InvalidTextValue' });
        assert.throws(() => compiler({ tag: '*', command: 'OK\nX' }), { code: 'InvalidTextValue' });
    });

    it('refuses nodes without a known type', () => {
        assert.throws(() => compile([{ value: 'x' }]), { code: 'InvalidNodeType' });
        assert.throws(() => compile([{ type: 'FOO', value: 'x' }]), { code: 'InvalidNodeType' });
    });

    it('writes only non-negative integers for numbers', () => {
        assert.equal(compile([1.6, -5, Infinity, { type: 'NUMBER', value: '7\r\nX' }, { type: 'NUMBER', value: 8 }]), '* CMD 2 0 0 0 8');
    });
});

describe('Round trips', () => {
    it('compiles parsed commands back to the same string', () => {
        for (const command of [
            'A1 FETCH 1:3,* (FLAGS BODY.PEEK[HEADER.FIELDS (From Subject)]<0.100>)',
            'A1 LOGIN user "pa\\"ss\\\\word"',
            'A1 APPEND INBOX (\\Seen) {5}\r\nab\r\nc',
            'A1 SEARCH OR (UID 1:5) FLAGGED',
            'A1 LIST "" "*"'
        ]) {
            assert.equal(compiler(parser(command)), command);
        }
    });
});

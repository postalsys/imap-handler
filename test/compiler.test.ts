import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parser, compiler as compile_ } from '../src/index.js';

// the tests also pass values the types do not allow, to check how they are handled
const compiler = (response: any, options?: any): string => compile_(response, options);

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
    const compile = (attributes: any) => compiler({ tag: '*', command: 'CMD', attributes });

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
    const compile = (attributes: any) => compiler({ tag: '*', command: 'CMD', attributes });

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
    const compile = (attributes: any) => compiler({ tag: '*', command: 'CMD', attributes });

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
    it('refuses TEXT chars that turn into line breaks when written as binary', () => {
        assert.throws(() => compiler({ tag: '*', command: 'OK', attributes: [{ type: 'TEXT', value: 'hi\u010d\u010a* BYE injected' }] }));
    });
    it('writes adjacent lists without SP when the list asks for it', () => {
        // only the lists at the start are joined, body-fld-param SP body-fld-dsp keeps its space
        const bodies: any = [['TEXT', 'PLAIN'], ['TEXT', 'HTML'], 'ALTERNATIVE', ['BOUNDARY', 'x'], ['INLINE', null]];
        bodies.adjacentLists = true;
        const addresses: any = [
            [null, null, 'a', 'b'],
            [null, null, 'c', 'd']
        ];
        addresses.adjacentLists = true;
        assert.strictEqual(
            compiler({ tag: '*', attributes: [bodies, addresses, [['x'], ['y']]] }),
            '* (("TEXT" "PLAIN")("TEXT" "HTML") "ALTERNATIVE" ("BOUNDARY" "x") ("INLINE" NIL)) ((NIL NIL "a" "b")(NIL NIL "c" "d")) (("x") ("y"))'
        );
    });
});

describe('literal8', () => {
    const compile = (attributes: any) => compiler({ tag: '*', command: 'CMD', attributes });

    it('writes LITERAL8 nodes', () => {
        // RFC 3516 4.3: msg-att-static =/ "BINARY" section-binary SP (nstring / literal8)
        assert.equal(
            compiler({
                tag: '*',
                command: '1 FETCH',
                attributes: [
                    [
                        { type: 'ATOM', value: 'BINARY', section: [] },
                        { type: 'LITERAL8', value: 'a\x00\r\n\xff' }
                    ]
                ]
            }),
            '* 1 FETCH (BINARY[] ~{5}\r\na\x00\r\n\xff)'
        );
        assert.equal(compile([{ type: 'literal8', value: Buffer.from([0, 1]) }, { type: 'LITERAL8' }]), '* CMD ~{2}\r\n\x00\x01 ~{0}\r\n');
    });

    it('round trips literal8 through the parser', () => {
        const command = 'A1 APPEND INBOX (\\Seen) ~{3}\r\na\x00b';
        assert.equal(compiler(parser(command, { literal8: true })), command);
    });
});

describe('UTF-8 option', () => {
    const compile = (attributes: any, options?: any) => compiler({ tag: '*', command: 'CMD', attributes }, options);
    const binary = (value: string) => Buffer.from(value).toString('binary');

    it('keeps literals for 8-bit values by default', () => {
        assert.equal(compile([binary('é')]), '* CMD {2}\r\n\xc3\xa9');
        assert.equal(compile([binary('é')], {}), '* CMD {2}\r\n\xc3\xa9');
    });

    it('quotes valid UTF-8 with utf8: true', () => {
        // RFC 9051 9 and RFC 9755 3: QUOTED-CHAR includes UTF8-2 / UTF8-3 / UTF8-4
        const options = { utf8: true };
        assert.equal(compile([binary('Pärnu "€" \\ 😀')], options), '* CMD "' + binary('Pärnu \\"€\\" \\\\ 😀') + '"');
        assert.equal(
            compile([{ type: 'STRING', value: binary('ß') }, { type: 'ATOM', value: binary('Ä') }, Buffer.from('ü')], options),
            '* CMD "\xc3\x9f" "\xc3\x84" "\xc3\xbc"'
        );
        // LITERAL nodes stay literals
        assert.equal(compile([{ type: 'LITERAL', value: binary('é') }], options), '* CMD {2}\r\n\xc3\xa9');
    });

    it('keeps literals for values that can not be quoted with utf8: true', () => {
        const options = { utf8: true };
        for (const value of ['\xc3', '\xc0\xaf', '\xed\xa0\x80', '\xf4\x90\x80\x80', '\xe9', '\xc3\xa9\r\n', '\xc3\xa9\x00', 'a\nb']) {
            assert.equal(compile([value], options), '* CMD {' + value.length + '}\r\n' + value, JSON.stringify(value));
        }
        // chars above 0xFF are not binary, the high byte would be lost when written
        assert.ok(compile(['éĀ'], options).startsWith('* CMD {'));
    });

    it('round trips UTF-8 quoted strings through the parser', () => {
        const command = 'A1 SELECT "' + binary('Gesendete Objekte/Entwürfe') + '"';
        assert.equal(compiler(parser(command, { utf8: true }), { utf8: true }), command);
    });
});

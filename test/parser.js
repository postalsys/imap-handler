'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { parser } = require('../index');

describe('TAG', () => {
    it('Get tag success', () => {
        assert.equal(parser('TAG1 CMD').tag, 'TAG1');
    });

    it('Get tag fail (unexpected WS)', () => {
        assert.throws(() => {
            parser(' TAG CMD');
        });
    });

    it('Get tag fail (untagged npt allowed)', () => {
        assert.throws(() => {
            parser('* CMD');
        });
    });

    it('Get tag fsuccess (allow untagged)', () => {
        parser('* CMD', {
            allowUntagged: true
        });
    });

    it('Get tag fail (empty tag)', () => {
        assert.throws(() => {
            parser('');
        });
    });

    it('Get tag fail (unexpected end)', () => {
        assert.throws(() => {
            parser('TAG1');
        });
    });

    it('Get tag fail (invalid char)', () => {
        assert.throws(() => {
            parser('TAG+1 CMD');
        });
    });
});

describe('COMMAND', () => {
    it('Get command success', () => {
        assert.equal(parser('TAG1 CMD').command, 'CMD');
    });

    it('Get command fail (unexpected WS)', () => {
        assert.throws(() => {
            parser('TAG1  CMD');
        });
    });

    it('Get command fail (empty command)', () => {
        assert.throws(() => {
            parser('TAG1 ');
        });
    });

    it('Get command fail (invalid char)', () => {
        assert.throws(() => {
            parser('TAG1 CM=D');
        });
    });
    it('Get multi word command', () => {
        assert.equal(parser('TAG1 UID FETCH').command, 'UID FETCH');
    });
});

describe('ATTRIBUTE', () => {
    it('Get attribute success', () => {
        assert.deepEqual(parser('TAG1 CMD FED').attributes, [
            {
                type: 'ATOM',
                value: 'FED'
            }
        ]);
    });

    it('Get attribute fail (invalid whitespace at end)', () => {
        assert.throws(() => {
            parser('TAG1 CMD FED ');
        });
    });

    it('Get attribute fail (invalid whitespace between value)', () => {
        assert.throws(() => {
            parser('TAG1 CMD FED  TED');
        });
    });

    it('Get attribute success (single whitespace between values)', () => {
        assert.deepEqual(parser('TAG1 CMD FED TED').attributes, [
            {
                type: 'ATOM',
                value: 'FED'
            },
            {
                type: 'ATOM',
                value: 'TED'
            }
        ]);
    });

    it('ATOM', () => {
        assert.deepEqual(parser('TAG1 CMD ABCDE').attributes, [
            {
                type: 'ATOM',
                value: 'ABCDE'
            }
        ]);
        assert.deepEqual(parser('TAG1 CMD ABCDE DEFGH').attributes, [
            {
                type: 'ATOM',
                value: 'ABCDE'
            },
            {
                type: 'ATOM',
                value: 'DEFGH'
            }
        ]);
        assert.deepEqual(parser('TAG1 CMD %').attributes, [
            {
                type: 'ATOM',
                value: '%'
            }
        ]);
        assert.deepEqual(parser('12.82 STATUS [Gmail].Trash (UIDNEXT UNSEEN HIGHESTMODSEQ)').attributes, [
            {
                type: 'ATOM',
                value: '[Gmail].Trash'
            },
            [
                {
                    type: 'ATOM',
                    value: 'UIDNEXT'
                },
                {
                    type: 'ATOM',
                    value: 'UNSEEN'
                },
                {
                    type: 'ATOM',
                    value: 'HIGHESTMODSEQ'
                }
            ]
        ]);
    });

    it('STRING', () => {
        assert.deepEqual(parser('TAG1 CMD "ABCDE"').attributes, [
            {
                type: 'STRING',
                value: 'ABCDE'
            }
        ]);
        assert.deepEqual(parser('TAG1 CMD "ABCDE" "DEFGH"').attributes, [
            {
                type: 'STRING',
                value: 'ABCDE'
            },
            {
                type: 'STRING',
                value: 'DEFGH'
            }
        ]);
    });

    it('LIST', () => {
        assert.deepEqual(parser('TAG1 CMD (1234)').attributes, [
            [
                {
                    type: 'ATOM',
                    value: '1234'
                }
            ]
        ]);
        assert.deepEqual(parser('TAG1 CMD (1234 TERE)').attributes, [
            [
                {
                    type: 'ATOM',
                    value: '1234'
                },
                {
                    type: 'ATOM',
                    value: 'TERE'
                }
            ]
        ]);
        assert.throws(() => {
            parser('TAG1 CMD (1234 )');
        });

        assert.throws(() => {
            parser('TAG1 CMD ( 1234)');
        });

        assert.throws(() => {
            parser('TAG1 CMD (1234) ');
        });
    });

    it('Nested LIST', () => {
        assert.deepEqual(parser('TAG1 CMD (((TERE)) VANA)').attributes, [
            [
                [
                    [
                        {
                            type: 'ATOM',
                            value: 'TERE'
                        }
                    ]
                ],
                {
                    type: 'ATOM',
                    value: 'VANA'
                }
            ]
        ]);

        assert.throws(() => {
            parser('TAG1 CMD (( (TERE)) VANA)');
        });
    });

    it('LITERAL', () => {
        assert.deepEqual(parser('TAG1 CMD {4}\r\nabcd').attributes, [
            {
                type: 'LITERAL',
                value: 'abcd'
            }
        ]);
        assert.deepEqual(parser('TAG1 CMD {4}\r\nabcd {4}\r\nkere').attributes, [
            {
                type: 'LITERAL',
                value: 'abcd'
            },
            {
                type: 'LITERAL',
                value: 'kere'
            }
        ]);
        assert.deepEqual(parser('TAG1 CMD ({4}\r\nabcd {4}\r\nkere)').attributes, [
            [
                {
                    type: 'LITERAL',
                    value: 'abcd'
                },
                {
                    type: 'LITERAL',
                    value: 'kere'
                }
            ]
        ]);

        assert.throws(() => {
            parser('TAG1 CMD {4}\r\nabcd{4}\r\nkere');
        });

        assert.throws(() => {
            parser('TAG1 CMD {4}\r\nabcd{4}  \r\nkere');
        });
    });

    it('ATOM Section', () => {
        assert.deepEqual(parser('TAG1 CMD BODY[]').attributes, [
            {
                type: 'ATOM',
                value: 'BODY',
                section: []
            }
        ]);
        assert.deepEqual(parser('TAG1 CMD BODY[(KERE)]').attributes, [
            {
                type: 'ATOM',
                value: 'BODY',
                section: [
                    [
                        {
                            type: 'ATOM',
                            value: 'KERE'
                        }
                    ]
                ]
            }
        ]);

        // By default only BODY and BODY.PEEK have sections, for others [ and ] are atom chars
        assert.deepEqual(parser('TAG1 CMD KODY[]').attributes, [
            {
                type: 'ATOM',
                value: 'KODY[]'
            }
        ]);

        // Allow KODY to have sections
        assert.deepEqual(
            parser('TAG1 CMD KoDY[]', {
                allowSection: ['KODY']
            }).attributes,
            [
                {
                    type: 'ATOM',
                    value: 'KoDY',
                    section: []
                }
            ]
        );
    });

    it('ATOM Partial', () => {
        assert.deepEqual(parser('TAG1 CMD BODY[]<0>').attributes, [
            {
                type: 'ATOM',
                value: 'BODY',
                section: [],
                partial: [0]
            }
        ]);
        assert.deepEqual(parser('TAG1 CMD BODY[]<12.45>').attributes, [
            {
                type: 'ATOM',
                value: 'BODY',
                section: [],
                partial: [12, 45]
            }
        ]);
        assert.deepEqual(parser('TAG1 CMD BODY[HEADER.FIELDS (Subject From)]<12.45>').attributes, [
            {
                type: 'ATOM',
                value: 'BODY',
                section: [
                    {
                        type: 'ATOM',
                        value: 'HEADER.FIELDS'
                    },
                    [
                        {
                            type: 'ATOM',
                            value: 'Subject'
                        },
                        {
                            type: 'ATOM',
                            value: 'From'
                        }
                    ]
                ],
                partial: [12, 45]
            }
        ]);

        // without a section < and > are atom chars
        assert.deepEqual(parser('TAG1 CMD KODY<0.123>').attributes, [
            {
                type: 'ATOM',
                value: 'KODY<0.123>'
            }
        ]);

        // RFC 3501 9: the origin is a number, so leading zeros are allowed
        assert.deepEqual(parser('TAG1 CMD BODY[]<01.5>').attributes, [
            {
                type: 'ATOM',
                value: 'BODY',
                section: [],
                partial: [1, 5]
            }
        ]);

        assert.throws(() => {
            parser('TAG1 CMD BODY[]<0.01>');
        });

        assert.throws(() => {
            parser('TAG1 CMD BODY[]<0.1.>');
        });
    });

    it('SEQUENCE', () => {
        assert.deepEqual(parser('TAG1 CMD *:4,5:7 TEST').attributes, [
            {
                type: 'SEQUENCE',
                value: '*:4,5:7'
            },
            {
                type: 'ATOM',
                value: 'TEST'
            }
        ]);

        assert.deepEqual(parser('TAG1 CMD 1:* TEST').attributes, [
            {
                type: 'SEQUENCE',
                value: '1:*'
            },
            {
                type: 'ATOM',
                value: 'TEST'
            }
        ]);

        assert.deepEqual(parser('TAG1 CMD *:4 TEST').attributes, [
            {
                type: 'SEQUENCE',
                value: '*:4'
            },
            {
                type: 'ATOM',
                value: 'TEST'
            }
        ]);

        assert.throws(() => {
            parser('TAG1 CMD *:4,5:');
        });

        assert.throws(() => {
            parser('TAG1 CMD *:4,5: TEST');
        });

        assert.throws(() => {
            parser('TAG1 CMD *4,5 TEST');
        });

        // RFC 3501 9: seq-number = nz-number / "*", so "*" may appear anywhere in a set
        assert.deepEqual(parser('TAG1 CMD *,5 TEST').attributes, [
            {
                type: 'SEQUENCE',
                value: '*,5'
            },
            {
                type: 'ATOM',
                value: 'TEST'
            }
        ]);

        assert.deepEqual(parser('TAG1 CMD 5,* TEST').attributes, [
            {
                type: 'SEQUENCE',
                value: '5,*'
            },
            {
                type: 'ATOM',
                value: 'TEST'
            }
        ]);

        assert.throws(() => {
            parser('TAG1 CMD 5, TEST');
        });
    });
});

describe('LITERAL length', () => {
    it('rejects letters in the literal length', () => {
        // RFC 3501 9: number = 1*DIGIT, and DIGIT is 0-9 only
        assert.throws(() => parser('TAG1 CMD {1e1}\r\n0123456789'));
        assert.throws(() => parser('TAG1 CMD {a}\r\nx'));
    });
});

describe('Sequence sets', () => {
    it('accepts * anywhere in a sequence set', () => {
        assert.deepEqual(parser('A1 FETCH * FLAGS').attributes, [
            { type: 'ATOM', value: '*' },
            { type: 'ATOM', value: 'FLAGS' }
        ]);
        assert.deepEqual(parser('A1 UID FETCH * FLAGS').attributes, [
            { type: 'ATOM', value: '*' },
            { type: 'ATOM', value: 'FLAGS' }
        ]);
        assert.deepEqual(parser('A1 FETCH 1:3,* FLAGS').attributes, [
            { type: 'SEQUENCE', value: '1:3,*' },
            { type: 'ATOM', value: 'FLAGS' }
        ]);
        assert.deepEqual(parser('A1 FETCH 1,*:2,5 FLAGS').attributes, [
            { type: 'SEQUENCE', value: '1,*:2,5' },
            { type: 'ATOM', value: 'FLAGS' }
        ]);
    });

    it('accepts a sequence set as the last element of a list', () => {
        assert.deepEqual(parser('A1 SEARCH OR (UID 1:5) FLAGGED').attributes, [
            { type: 'ATOM', value: 'OR' },
            [
                { type: 'ATOM', value: 'UID' },
                { type: 'SEQUENCE', value: '1:5' }
            ],
            { type: 'ATOM', value: 'FLAGGED' }
        ]);
        assert.deepEqual(parser('A1 SEARCH (*)').attributes, [[{ type: 'ATOM', value: '*' }]]);
        assert.deepEqual(parser('A1 SELECT INBOX (QRESYNC (67890007 20050715194045000 41,43:211,214:541))').attributes, [
            { type: 'ATOM', value: 'INBOX' },
            [
                { type: 'ATOM', value: 'QRESYNC' },
                [
                    { type: 'ATOM', value: '67890007' },
                    { type: 'ATOM', value: '20050715194045000' },
                    { type: 'SEQUENCE', value: '41,43:211,214:541' }
                ]
            ]
        ]);
    });

    it('rejects malformed sequence sets', () => {
        assert.throws(() => parser('A1 FETCH 5: FLAGS'), { code: 'ParserError' });
        assert.throws(() => parser('A1 FETCH 5,'));
        assert.throws(() => parser('A1 FETCH 1:2:3 FLAGS'));
        assert.throws(() => parser('A1 FETCH *4 FLAGS'));
        assert.throws(() => parser('A1 SEARCH (1:5,)'));
    });

    it('parses a large sequence set in linear time', () => {
        const set = Array.from({ length: 150000 }, (v, i) => i + 1).join(',');
        const start = Date.now();
        assert.deepEqual(parser('A1 FETCH ' + set + ' FLAGS').attributes[0], { type: 'SEQUENCE', value: set });
        assert.ok(Date.now() - start < 2000);
    });
});

describe('Unquoted values', () => {
    it('accepts valid atoms and astrings', () => {
        // RFC 3501 9: ASTRING-CHAR includes "]", ATOM-CHAR includes "[" and "<"
        assert.deepEqual(parser('A1 SELECT ]ab').attributes, [{ type: 'ATOM', value: ']ab' }]);
        assert.deepEqual(parser('A1 SELECT Foo[1]').attributes, [{ type: 'ATOM', value: 'Foo[1]' }]);
        assert.deepEqual(parser('A1 SELECT a<b').attributes, [{ type: 'ATOM', value: 'a<b' }]);
        // a value that only starts like a sequence set is an atom
        assert.deepEqual(parser('A1 SELECT 2024:Q1').attributes, [{ type: 'ATOM', value: '2024:Q1' }]);
        // RFC 3501 9: list-mailbox may contain list-wildcards anywhere
        assert.deepEqual(parser('A1 LIST "" INBOX/*').attributes, [
            { type: 'STRING', value: '' },
            { type: 'ATOM', value: 'INBOX/*' }
        ]);
        assert.deepEqual(parser('A1 LIST "" *%').attributes, [
            { type: 'STRING', value: '' },
            { type: 'ATOM', value: '*%' }
        ]);
    });

    it('rejects values glued to a list or a section', () => {
        assert.throws(() => parser('A1 CMD (a)<b'));
        assert.throws(() => parser('A1 CMD (a)b'));
        assert.throws(() => parser('A1 CMD BODY[]]'));
        assert.throws(() => parser('A1 CMD BODY[ ]'));
        assert.throws(() => parser('A1 CMD "a"b'));
    });
});

describe('Quoted strings', () => {
    it('decodes escaped quotes and backslashes', () => {
        assert.deepEqual(parser('A1 LOGIN user "pa\\"ss"').attributes, [
            { type: 'ATOM', value: 'user' },
            { type: 'STRING', value: 'pa"ss' }
        ]);
        assert.deepEqual(parser('A1 LOGIN user "pa\\\\ss" "\\\\"').attributes, [
            { type: 'ATOM', value: 'user' },
            { type: 'STRING', value: 'pa\\ss' },
            { type: 'STRING', value: '\\' }
        ]);
    });

    it('rejects invalid escapes and chars', () => {
        // RFC 3501 9: only DQUOTE and "\" may be escaped
        assert.throws(() => parser('A1 CMD "a\\b"'));
        assert.throws(() => parser('A1 CMD "a\\"'));
        assert.throws(() => parser('A1 CMD "a\rb"'));
        assert.throws(() => parser('A1 CMD "a\x00b"'));
    });
});

describe('Literals', () => {
    it('accepts an empty literal', () => {
        assert.deepEqual(parser('A1 CMD {0}\r\n').attributes, [{ type: 'LITERAL', value: '' }]);
        assert.deepEqual(parser('A1 CMD {0}\r\n X').attributes, [
            { type: 'LITERAL', value: '' },
            { type: 'ATOM', value: 'X' }
        ]);
        assert.deepEqual(parser('A1 CMD ({0}\r\n)').attributes, [[{ type: 'LITERAL', value: '' }]]);
    });

    it('accepts leading zeros in the literal length', () => {
        assert.deepEqual(parser('A1 CMD {04}\r\nabcd').attributes, [{ type: 'LITERAL', value: 'abcd' }]);
    });

    it('accepts {n+} only with literalPlus', () => {
        assert.deepEqual(parser('A1 CMD {4+}\r\nabcd', { literalPlus: true }).attributes, [{ type: 'LITERAL', value: 'abcd' }]);
        assert.throws(() => parser('A1 CMD {4+}\r\nabcd'));
    });

    it('rejects malformed LITERAL+ markers', () => {
        // RFC 7888 8: literal = "{" number64 ["+"] "}" CRLF
        assert.throws(() => parser('A1 CMD {+4}\r\nabcd', { literalPlus: true }));
        assert.throws(() => parser('A1 CMD {1+0}\r\nabcdefghij', { literalPlus: true }));
        assert.throws(() => parser('A1 CMD {}\r\n'));
    });

    it('rejects short literals and NUL', () => {
        assert.throws(() => parser('A1 CMD {5}\r\nabcd'));
        assert.throws(() => parser('A1 CMD {3}\r\na\x00b'));
    });
});

describe('Partials', () => {
    it('validates the partial range', () => {
        assert.deepEqual(parser('A1 FETCH 1 BODY[]<5>').attributes[1].partial, [5]);
        assert.deepEqual(parser('A1 FETCH 1 BODY[]<4294967295.4294967295>').attributes[1].partial, [4294967295, 4294967295]);
        // RFC 3501 9: the length is a nz-number
        assert.throws(() => parser('A1 FETCH 1 BODY[]<0.0>'));
        assert.throws(() => parser('A1 FETCH 1 BODY[]<0.01>'));
        // and both are 32-bit
        assert.throws(() => parser('A1 FETCH 1 BODY[]<4294967296.1>'));
        assert.throws(() => parser('A1 FETCH 1 BODY[]<0.4294967296>'));
        assert.throws(() => parser('A1 FETCH 1 BODY[]<.5>'));
        assert.throws(() => parser('A1 FETCH 1 BODY[]<5'));
    });
});

describe('Limits and errors', () => {
    it('limits nesting depth', () => {
        assert.equal(parser('A1 CMD ' + '('.repeat(20) + ')'.repeat(20)).attributes.length, 1);
        assert.throws(() => parser('A1 CMD ' + '('.repeat(10000) + ')'.repeat(10000)), { code: 'MaxNestingReached' });
    });

    it('reports error positions and codes', () => {
        assert.throws(() => parser('TAG1 CMD FED '), { code: 'ParserError', pos: 12, message: 'Unexpected whitespace at position 12' });
        assert.throws(() => parser('TAG1 CMD (FED'), { code: 'ParserError', pos: 13 });
        assert.throws(() => parser('TAG1 CMD BODY[]<0.1.>'), { pos: 19 });
    });

    it('does not modify the options object', () => {
        const options = { literalPlus: true };
        parser('A1 CMD BODY[]', options);
        assert.deepEqual(options, { literalPlus: true });
    });
});

describe('literal8', () => {
    it('parses ~{n} only with the literal8 option', () => {
        // RFC 3516 7 and RFC 9051 9: literal8 = "~{" number64 "}" CRLF *OCTET
        assert.deepEqual(parser('A1 APPEND INBOX (\\Seen) ~{5}\r\nab\x00cd', { literal8: true }).attributes, [
            { type: 'ATOM', value: 'INBOX' },
            [{ type: 'ATOM', value: '\\Seen' }],
            { type: 'LITERAL8', value: 'ab\x00cd' }
        ]);
        assert.deepEqual(parser('A1 CMD ~{0}\r\n', { literal8: true }).attributes, [{ type: 'LITERAL8', value: '' }]);
        assert.deepEqual(parser('A1 CMD (~{1}\r\n\xff ~{1}\n\x00)', { literal8: true }).attributes, [
            [
                { type: 'LITERAL8', value: '\xff' },
                { type: 'LITERAL8', value: '\x00' }
            ]
        ]);
        assert.throws(() => parser('A1 APPEND INBOX ~{3}\r\nabc'), { code: 'ParserError', pos: 17 });
    });

    it('keeps ~ an atom char', () => {
        assert.deepEqual(parser('A1 SELECT ~user', { literal8: true }).attributes, [{ type: 'ATOM', value: '~user' }]);
        assert.deepEqual(parser('A1 SELECT ~').attributes, [{ type: 'ATOM', value: '~' }]);
        assert.throws(() => parser('A1 SELECT a~{1}\r\nx', { literal8: true }));
    });

    it('accepts ~{n+} only together with literalPlus', () => {
        // RFC 4466 3: the "+" is only allowed when both LITERAL+ and BINARY are supported
        assert.deepEqual(parser('A1 CMD ~{2+}\r\n\x00\x01', { literal8: true, literalPlus: true }).attributes, [{ type: 'LITERAL8', value: '\x00\x01' }]);
        assert.throws(() => parser('A1 CMD ~{2+}\r\n\x00\x01', { literal8: true }));
    });

    it('rejects malformed literal8', () => {
        const options = { literal8: true, literalPlus: true };
        assert.throws(() => parser('A1 CMD ~{}\r\n', options));
        assert.throws(() => parser('A1 CMD ~{+1}\r\nx', options));
        assert.throws(() => parser('A1 CMD ~{1}x', options));
        assert.throws(() => parser('A1 CMD ~{a}\r\nx', options));
        // a space after ~ makes it an atom followed by a plain literal
        assert.deepEqual(parser('A1 CMD ~ {1}\r\nx', options).attributes, [
            { type: 'ATOM', value: '~' },
            { type: 'LITERAL', value: 'x' }
        ]);
        assert.throws(() => parser('A1 CMD ~{5}\r\nabcd', options), { pos: 17 });
        assert.throws(() => parser('A1 CMD ~{4294967296}\r\n', options));
        assert.throws(() => parser('A1 CMD ~{1}\r\nab', options));
    });

    it('still rejects NUL in a plain literal', () => {
        assert.throws(() => parser('A1 CMD {1}\r\n\x00', { literal8: true }));
    });
});

describe('UTF-8 in quoted strings', () => {
    const utf8 = { utf8: true };

    it('accepts UTF8-2, UTF8-3 and UTF8-4 with the utf8 option', () => {
        // RFC 9051 9: QUOTED-CHAR =/ UTF8-2 / UTF8-3 / UTF8-4, RFC 9755 3: uQUOTED-CHAR
        for (const chr of ['é', 'ß', '\u0080', '߿', 'ࠀ', '€', '퟿', '', '￿', '😀', '\u{10000}', '\u{10ffff}']) {
            const value = Buffer.from('a' + chr + 'b').toString('binary');
            assert.deepEqual(parser('A1 SELECT "' + value + '"', utf8).attributes, [{ type: 'STRING', value }], JSON.stringify(chr));
        }
        // value stays a binary string, escapes still work
        assert.deepEqual(parser('A1 SELECT "\xc3\xa9\\"\xe2\x82\xac"', utf8).attributes, [{ type: 'STRING', value: '\xc3\xa9"\xe2\x82\xac' }]);
    });

    it('rejects 8-bit chars without the option', () => {
        assert.throws(() => parser('A1 SELECT "\xc3\xa9"'), { pos: 11 });
    });

    it('rejects invalid UTF-8', () => {
        // RFC 9755 3: the server MUST reject octets with the high bit set that are not valid UTF-8 (RFC 3629 4)
        const invalid = {
            'lone tail': '\x80',
            'C0 overlong': '\xc0\xaf',
            'C1 overlong': '\xc1\xbf',
            'E0 overlong': '\xe0\x80\xaf',
            'F0 overlong': '\xf0\x8f\xbf\xbf',
            surrogate: '\xed\xa0\x80',
            'above U+10FFFF': '\xf4\x90\x80\x80',
            'F5 lead': '\xf5\x80\x80\x80',
            'FF octet': '\xff',
            'truncated 2': '\xc3',
            'truncated 3': '\xe2\x82',
            'truncated 4': '\xf0\x9f\x98',
            'ASCII as tail': '\xc3A',
            'too many tails': '\xc3\xa9\xa9',
            'char above 0xFF': 'éĀ'
        };
        for (const [name, value] of Object.entries(invalid)) {
            assert.throws(() => parser('A1 SELECT "' + value + '"', utf8), { code: 'ParserError' }, name);
        }
        // the position points at the start of the string value
        assert.throws(() => parser('A1 SELECT "ab\xc3"', utf8), { pos: 11, message: /Invalid UTF-8/ });
        assert.throws(() => parser('A1 SELECT x "\xe2\x82"', utf8), { pos: 13 });
        // a char above 0xFF is not an octet
        assert.throws(() => parser('A1 SELECT "Ā"', utf8), { pos: 11, message: /Unexpected char/ });
    });

    it('does not allow 8-bit chars outside quoted strings', () => {
        assert.throws(() => parser('A1 SELECT \xc3\xa9', utf8));
        assert.throws(() => parser('A1 SELECT "\xc3\xa9\r\n"', utf8));
        assert.throws(() => parser('A1 SELECT "\xc3\xa9\x00"', utf8));
    });
});

describe('Extension syntax', () => {
    const atom = value => ({ type: 'ATOM', value });
    const seq = value => ({ type: 'SEQUENCE', value });
    const str = value => ({ type: 'STRING', value });

    it('parses ESEARCH return options and SEARCHRES $', () => {
        // RFC 4466 3: search-return-opts = SP "RETURN" SP "(" [search-return-opt *(SP search-return-opt)] ")"
        assert.deepEqual(parser('A1 UID SEARCH RETURN (MIN MAX COUNT SAVE) UNDELETED').attributes, [
            atom('RETURN'),
            [atom('MIN'), atom('MAX'), atom('COUNT'), atom('SAVE')],
            atom('UNDELETED')
        ]);
        assert.deepEqual(parser('A1 SEARCH RETURN () ALL').attributes, [atom('RETURN'), [], atom('ALL')]);
        // RFC 9051 9: seq-last-command = "$", returned as an ATOM, the caller decides where it is allowed
        assert.deepEqual(parser('A1 UID FETCH $ (FLAGS)').attributes, [atom('$'), [atom('FLAGS')]]);
        assert.deepEqual(parser('A1 SEARCH UID $ OR $ 1:5').attributes, [atom('UID'), atom('$'), atom('OR'), atom('$'), seq('1:5')]);
    });

    it('parses PARTIAL ranges', () => {
        // RFC 9394 4: partial-range-first = nz-number ":" nz-number, partial-range-last = MINUS nz-number ":" MINUS nz-number
        assert.deepEqual(parser('A1 UID SEARCH RETURN (PARTIAL 1:100) UNDELETED').attributes, [
            atom('RETURN'),
            [atom('PARTIAL'), seq('1:100')],
            atom('UNDELETED')
        ]);
        assert.deepEqual(parser('A1 UID SEARCH RETURN (PARTIAL -1:-100) UNDELETED').attributes, [
            atom('RETURN'),
            [atom('PARTIAL'), atom('-1:-100')],
            atom('UNDELETED')
        ]);
        // RFC 9394 4: fetch-modifier =/ modifier-partial
        assert.deepEqual(parser('A1 UID FETCH 1:* (FLAGS) (PARTIAL -1:-30)').attributes, [seq('1:*'), [atom('FLAGS')], [atom('PARTIAL'), atom('-1:-30')]]);
    });

    it('parses LIST-EXTENDED selection and return options', () => {
        // RFC 5258 6: list = "LIST" [SP list-select-opts] SP mailbox SP mbox-or-pat [SP list-return-opts]
        assert.deepEqual(parser('A1 LIST (SUBSCRIBED RECURSIVEMATCH) "" ("INBOX" %/* Drafts) RETURN (CHILDREN STATUS (MESSAGES SIZE))').attributes, [
            [atom('SUBSCRIBED'), atom('RECURSIVEMATCH')],
            str(''),
            [str('INBOX'), atom('%/*'), atom('Drafts')],
            atom('RETURN'),
            [atom('CHILDREN'), atom('STATUS'), [atom('MESSAGES'), atom('SIZE')]]
        ]);
        assert.deepEqual(parser('A1 LIST () "" (* %)').attributes, [[], str(''), [atom('*'), atom('%')]]);
    });

    it('parses STATUS=SIZE', () => {
        // RFC 8438 3: status-att =/ "SIZE", status-att-val =/ "SIZE" SP number64
        assert.deepEqual(parser('A1 STATUS INBOX (MESSAGES SIZE)').attributes, [atom('INBOX'), [atom('MESSAGES'), atom('SIZE')]]);
        assert.deepEqual(parser('* STATUS INBOX (SIZE 9223372036854775807)', { allowUntagged: true }).attributes, [
            atom('INBOX'),
            [atom('SIZE'), atom('9223372036854775807')]
        ]);
    });

    it('parses BINARY sections when the caller allows them', () => {
        // RFC 3516 7: fetch-att =/ "BINARY" [".PEEK"] section-binary [partial] / "BINARY.SIZE" section-binary
        const allowSection = ['BODY', 'BODY.PEEK', 'BINARY', 'BINARY.PEEK', 'BINARY.SIZE'];
        assert.deepEqual(parser('A1 FETCH 1 (BINARY[1.2]<0.100> BINARY.PEEK[] BINARY.SIZE[3])', { allowSection }).attributes, [
            atom('1'),
            [
                { type: 'ATOM', value: 'BINARY', section: [atom('1.2')], partial: [0, 100] },
                { type: 'ATOM', value: 'BINARY.PEEK', section: [] },
                { type: 'ATOM', value: 'BINARY.SIZE', section: [atom('3')] }
            ]
        ]);
        // the grammar has no partial after BINARY.SIZE, the parser still returns it for the caller to refuse
        assert.deepEqual(parser('A1 FETCH 1 BINARY.SIZE[]<0.1>', { allowSection }).attributes[1], {
            type: 'ATOM',
            value: 'BINARY.SIZE',
            section: [],
            partial: [0, 1]
        });
        // without the names in allowSection [ and < are plain ATOM-CHARs as before
        assert.deepEqual(parser('A1 FETCH 1 BINARY[1]<0.100>').attributes, [atom('1'), atom('BINARY[1]<0.100>')]);
        // a FETCH BINARY response with a literal8
        assert.deepEqual(parser('* 1 FETCH (BINARY[] ~{2}\r\n\x00\x01)', { allowUntagged: true, allowSection, literal8: true }).attributes, [
            atom('FETCH'),
            [
                { type: 'ATOM', value: 'BINARY', section: [] },
                { type: 'LITERAL8', value: '\x00\x01' }
            ]
        ]);
    });

    it('parses QRESYNC parameters and VANISHED', () => {
        // RFC 7162 7: select-param =/ "QRESYNC" SP "(" uidvalidity SP mod-sequence-value [SP known-uids] [SP seq-match-data] ")"
        assert.deepEqual(parser('A1 SELECT INBOX (QRESYNC (67890007 90060115194045000 1:29997 (5000,7500,9000 15000,22500,27000)))').attributes, [
            atom('INBOX'),
            [atom('QRESYNC'), [atom('67890007'), atom('90060115194045000'), seq('1:29997'), [seq('5000,7500,9000'), seq('15000,22500,27000')]]]
        ]);
        assert.deepEqual(parser('A1 UID FETCH 300:500 (FLAGS) (CHANGEDSINCE 12345 VANISHED)').attributes, [
            seq('300:500'),
            [atom('FLAGS')],
            [atom('CHANGEDSINCE'), atom('12345'), atom('VANISHED')]
        ]);
        assert.deepEqual(parser('* VANISHED (EARLIER) 41,43:116', { allowUntagged: true }).attributes, [[atom('EARLIER')], seq('41,43:116')]);
    });

    it('parses CATENATE and MULTIAPPEND', () => {
        // RFC 4469 5: append-data =/ "CATENATE" SP "(" cat-part *(SP cat-part) ")"
        assert.deepEqual(
            parser('A1 APPEND Drafts (\\Seen) CATENATE (URL "/Drafts;UIDVALIDITY=385759045/;UID=20/;section=HEADER" TEXT {4}\r\nab\r\n URL x)').attributes,
            [
                atom('Drafts'),
                [atom('\\Seen')],
                atom('CATENATE'),
                [
                    atom('URL'),
                    str('/Drafts;UIDVALIDITY=385759045/;UID=20/;section=HEADER'),
                    atom('TEXT'),
                    { type: 'LITERAL', value: 'ab\r\n' },
                    atom('URL'),
                    atom('x')
                ]
            ]
        );
        // RFC 3502 formal syntax and RFC 4466 3: append = "APPEND" SP mailbox 1*append-message
        assert.deepEqual(
            parser('A1 APPEND INBOX (\\Seen) "01-Jan-2024 00:00:00 +0000" {1}\r\na () ~{1}\r\n\x00 {1+}\r\nc', { literal8: true, literalPlus: true })
                .attributes,
            [
                atom('INBOX'),
                [atom('\\Seen')],
                str('01-Jan-2024 00:00:00 +0000'),
                { type: 'LITERAL', value: 'a' },
                [],
                { type: 'LITERAL8', value: '\x00' },
                { type: 'LITERAL', value: 'c' }
            ]
        );
    });

    it('parses SORT and THREAD', () => {
        // RFC 5256 5: sort = ["UID" SP] "SORT" SP sort-criteria SP search-criteria
        assert.deepEqual(parser('A1 UID SORT (REVERSE ARRIVAL SUBJECT) UTF-8 ALL').attributes, [
            [atom('REVERSE'), atom('ARRIVAL'), atom('SUBJECT')],
            atom('UTF-8'),
            atom('ALL')
        ]);
        assert.deepEqual(parser('A1 THREAD REFERENCES "UTF-8" SINCE 1-Feb-1994').attributes, [
            atom('REFERENCES'),
            str('UTF-8'),
            atom('SINCE'),
            atom('1-Feb-1994')
        ]);
        // RFC 5267 5: extended-sort = ["UID" SP] "SORT" search-return-opts, ESORT return options before the sort criteria
        assert.deepEqual(parser('A1 SORT RETURN (MIN) (DATE) UTF-8 ALL').attributes, [
            atom('RETURN'),
            [atom('MIN')],
            [atom('DATE')],
            atom('UTF-8'),
            atom('ALL')
        ]);
    });
});

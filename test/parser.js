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

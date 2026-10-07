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

        assert.throws(() => {
            // By default BODY and BODY.PEEK are allowed to have sections
            parser('TAG1 CMD KODY[]');
        });

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

        assert.throws(() => {
            parser('TAG1 CMD KODY<0.123>');
        });

        assert.throws(() => {
            parser('TAG1 CMD BODY[]<01>');
        });

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
            parser('TAG1 CMD *:4,5:TEST TEST');
        });

        assert.throws(() => {
            parser('TAG1 CMD *:4,5: TEST');
        });

        assert.throws(() => {
            parser('TAG1 CMD *4,5 TEST');
        });

        assert.throws(() => {
            parser('TAG1 CMD *,5 TEST');
        });

        assert.throws(() => {
            parser('TAG1 CMD 5,* TEST');
        });

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

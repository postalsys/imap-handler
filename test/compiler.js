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

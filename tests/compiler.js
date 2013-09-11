var parser = require("../index").parser,
    compiler = require("../index").compiler;

module.exports["Test compiler"] = function(test){
    var command = '* FETCH (ENVELOPE ("Mon, 2 Sep 2013 05:30:13 -0700 (PDT)" NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "tr.ee")) NIL NIL NIL "<-4730417346358914070@unknownmsgid>") BODYSTRUCTURE (("MESSAGE" "RFC822" NIL NIL NIL "7BIT" 105 (NIL NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "pangalink.net")) NIL NIL "<test1>" NIL) ("TEXT" "PLAIN" NIL NIL NIL "7BIT" 12 0 NIL NIL NIL) 5 NIL NIL NIL) ("MESSAGE" "RFC822" NIL NIL NIL "7BIT" 83 (NIL NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "pangalink.net")) NIL NIL "NIL" NIL) ("TEXT" "PLAIN" NIL NIL NIL "7BIT" 12 0 NIL NIL NIL) 4 NIL NIL NIL) ("TEXT" "HTML" ("CHARSET" "utf-8") NIL NIL "QUOTED-PRINTABLE" 19 0 NIL NIL NIL) "MIXED" ("BOUNDARY" "----mailcomposer-?=_1-1328088797399") NIL NIL))';
    var parsed = parser(command, {allowUntagged: true});
    var compiled = compiler(parsed);

    test.equal(command, compiled);
    test.done()
}

module.exports["Test Types"] = {
    "No attributes": function(test){
        var parsed = {
            tag: "*",
            command: "CMD"
        };
        var compiled = compiler(parsed);

        test.equal("* CMD", compiled);
        test.done()
    },

    "TEXT": function(test){
        var parsed = {
            tag: "*",
            command: "CMD",
            attributes: [
                {type: "TEXT", value: "Tere tere!"}
            ]
        };
        var compiled = compiler(parsed);

        test.equal("* CMD Tere tere!", compiled);
        test.done()
    },

    "SECTION": function(test){
        var parsed = {
            tag: "*",
            command: "CMD",
            attributes: [
                {type: "SECTION", section:[
                    {type: "ATOM", value: "ALERT"}
                ]}
            ]
        };
        var compiled = compiler(parsed);

        test.equal("* CMD [ALERT]", compiled);
        test.done()
    },

    "ATOM": function(test){
        var parsed = {
            tag: "*",
            command: "CMD",
            attributes: [
                {type: "ATOM", value: "ALERT"},
                {type: "ATOM", value: "\\ALERT"},
                {type: "ATOM", value: "NO ALERT"}
            ]
        };
        var compiled = compiler(parsed);
        test.equal("* CMD ALERT \\ALERT \"NO ALERT\"", compiled);
        test.done()
    },

    "SEQUENCE": function(test){
        var parsed = {
            tag: "*",
            command: "CMD",
            attributes: [
                {type: "SEQUENCE", value: "*:4,5,6"}
            ]
        };
        var compiled = compiler(parsed);

        test.equal("* CMD *:4,5,6", compiled);
        test.done()
    }
}
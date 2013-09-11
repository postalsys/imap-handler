var parser = require("../index").parser;

module.exports["TAG"] = {
    "Get tag success": function(test){
        try{
            test.equal(parser("TAG1 CMD").tag, "TAG1");
        }catch(E){
            test.ifError(E);
        }
        test.done();
    },

    "Get tag fail (unexpected WS)": function(test){
        test.expect(1);
        try{
            parser(" TAG CMD");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    },

    "Get tag fail (untagged npt allowed)": function(test){
        test.expect(1);
        try{
            parser("* CMD");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    },

    "Get tag fsuccess (allow untagged)": function(test){
        test.expect(1);
        try{
            parser("* CMD", {allowUntagged: true});
            test.ok(true);
        }catch(E){
            test.ifError(E);
        }
        test.done();
    },

    "Get tag fail (empty tag)": function(test){
        test.expect(1);
        try{
            parser("");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    },

    "Get tag fail (unexpected end)": function(test){
        test.expect(1);
        try{
            parser("TAG1");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    },

    "Get tag fail (invalid char)": function(test){
        test.expect(1);
        try{
            parser("TAG+1 CMD");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    }
}

module.exports["COMMAND"] = {
    "Get command success": function(test){
        try{
            test.equal(parser("TAG1 CMD").command, "CMD");
        }catch(E){
            test.ifError(E);
        }
        test.done();
    },

    "Get command fail (unexpected WS)": function(test){
        test.expect(1);
        try{
            parser("TAG1  CMD");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    },

    "Get command fail (empty command)": function(test){
        test.expect(1);
        try{
            parser("TAG1 ");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    },

    "Get command fail (invalid char)": function(test){
        test.expect(1);
        try{
            parser("TAG1 CM=D");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    }
}

module.exports["ATTRIBUTE"] = {
    "Get attribute success": function(test){
        try{
            test.deepEqual(parser("TAG1 CMD FED").attributes, [{type:"ATOM", value:"FED"}]);
            test.ok(true);
        }catch(E){
            test.ifError(E);
        }
        test.done();
    },

    "Get attribute fail (invalid whitespace at end)": function(test){
        try{
            parser("TAG1 CMD FED ");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    },

    "Get attribute fail (invalid whitespace between value)": function(test){
        try{
            parser("TAG1 CMD FED  TED");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    },

    "Get attribute success (single whitespace between values)": function(test){
        try{
            test.deepEqual(parser("TAG1 CMD FED TED").attributes, [{type:"ATOM", value:"FED"}, {type:"ATOM", value:"TED"}]);
            test.ok(true);
        }catch(E){
            test.ifError(E);
        }
        test.done();
    },

    "ATOM": function(test){
        try{
            test.deepEqual(parser("TAG1 CMD ABCDE").attributes, [{type:"ATOM", value:"ABCDE"}]);
            test.deepEqual(parser("TAG1 CMD ABCDE DEFGH").attributes, [{type:"ATOM", value:"ABCDE"}, {type:"ATOM", value:"DEFGH"}]);
            test.ok(true);
        }catch(E){
            test.ifError(E);
        }
        test.done();
    },

    "STRING": function(test){
        try{
            test.deepEqual(parser("TAG1 CMD \"ABCDE\"").attributes, [{type:"STRING", value:"ABCDE"}]);
            test.deepEqual(parser("TAG1 CMD \"ABCDE\" \"DEFGH\"").attributes, [{type:"STRING", value:"ABCDE"}, {type:"STRING", value:"DEFGH"}]);
            test.ok(true);
        }catch(E){
            test.ifError(E);
        }
        test.done();
    },

    "LIST": function(test){
        try{
            test.deepEqual(parser("TAG1 CMD (1234)").attributes, [[{type:"ATOM", value: 1234}]]);
            test.deepEqual(parser("TAG1 CMD (1234 TERE)").attributes, [[{type:"ATOM", value: 1234}, {type:"ATOM", value: "TERE"}]]);
            test.ok(true);
        }catch(E){
            test.ifError(E);
        }
        try{
            parser("TAG1 CMD (1234 )");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        try{
            parser("TAG1 CMD ( 1234)");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        try{
            parser("TAG1 CMD (1234) ");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    },

    "Nested LIST": function(test){
        try{
            test.deepEqual(parser("TAG1 CMD (((TERE)) VANA)").attributes, [[[[{type: "ATOM", value: "TERE"}]], {type: "ATOM", value: "VANA"}]]);
            test.ok(true);
        }catch(E){
            test.ifError(E);
        }

        try{
            parser("TAG1 CMD (( (TERE)) VANA)");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    },

    "LITERAL": function(test){
        try{
            test.deepEqual(parser("TAG1 CMD {4}\r\nabcd").attributes, [{type: "LITERAL", value: "abcd"}]);
            test.deepEqual(parser("TAG1 CMD {4}\r\nabcd {4}\r\nkere").attributes, [{type: "LITERAL", value: "abcd"}, {type: "LITERAL", value: "kere"}]);
            test.deepEqual(parser("TAG1 CMD ({4}\r\nabcd {4}\r\nkere)").attributes, [[{type: "LITERAL", value: "abcd"}, {type: "LITERAL", value: "kere"}]]);
            test.ok(true);
        }catch(E){
            test.ifError(E);
        }

        try{
            parser("TAG1 CMD {4}\r\nabcd{4}\r\nkere");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        try{
            parser("TAG1 CMD {4}\r\nabcd{4}  \r\nkere");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    },

    "ATOM Section": function(test){
        try{
            test.deepEqual(parser("TAG1 CMD BODY[]").attributes, [{type:"ATOM", value:"BODY", section: []}]);
            test.deepEqual(parser("TAG1 CMD BODY[(KERE)]").attributes, [{type:"ATOM", value:"BODY", section: [[{type: "ATOM", value:"KERE"}]]}]);
            test.ok(true);
        }catch(E){
            test.ifError(E);
        }

        try{
            // By default BODY and BODY.PEEK are allowed to have sections
            parser("TAG1 CMD KODY[]");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        // Allow KODY to have sections
        test.deepEqual(parser("TAG1 CMD KoDY[]", {allowSection: ["KODY"]}).attributes, [{type:"ATOM", value:"KoDY", section: []}]);
        test.done();
    },

    "ATOM Partial": function(test){
        try{
            test.deepEqual(parser("TAG1 CMD BODY[]<0>").attributes, [{type:"ATOM", value:"BODY", section:[], partial: [0]}]);
            test.deepEqual(parser("TAG1 CMD BODY[]<12.45>").attributes, [{type:"ATOM", value:"BODY", section:[], partial: [12, 45]}]);
            test.deepEqual(parser("TAG1 CMD BODY[HEADER.FIELDS (Subject From)]<12.45>").attributes, [{type:"ATOM", value:"BODY", section:[ { type: 'ATOM', value: 'HEADER.FIELDS' },[{type: "ATOM", value: "Subject"}, {type: "ATOM", value: "From"}]], partial: [12, 45]}]);
            test.ok(true);
        }catch(E){
            test.ifError(E);
        }

        try{
            parser("TAG1 CMD KODY<0.123>");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        try{
            parser("TAG1 CMD BODY[]<123.0>");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        try{
            parser("TAG1 CMD BODY[]<01>");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        try{
            parser("TAG1 CMD BODY[]<0.01>");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        try{
            parser("TAG1 CMD BODY[]<0.1.>");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }
        test.done();
    },

    "SEQUENCE": function(test){
        try{
            test.deepEqual(parser("TAG1 CMD *:4,5:7 TEST").attributes, [{type:"SEQUENCE", value:"*:4,5:7"}, {type:"ATOM", value:"TEST"}]);
            test.ok(true);
        }catch(E){
            test.ifError(E);
        }

        try{
            parser("TAG1 CMD *:4,5:");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        try{
            parser("TAG1 CMD *:4,5:TEST TEST");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        try{
            parser("TAG1 CMD *:4,5: TEST");
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        try{
            console.log(parser("TAG1 CMD *4,5 TEST"));
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        try{
            console.log(parser("TAG1 CMD *,5 TEST"));
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        try{
            console.log(parser("TAG1 CMD 5,* TEST"));
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        try{
            console.log(parser("TAG1 CMD 5, TEST"));
            test.ok(false);
        }catch(E){
            test.ok(E);
        }

        test.done();
    }

}
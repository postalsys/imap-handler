var formalSyntax = require("./formal");

module.exports = function(command, options){
    var parser, response = {};
    
    options = options || {};
    options.allowSection = options.allowSection || ["BODY", "BODY.PEEK"];
    options.allowUntagged = !!options.allowUntagged;

    parser = new ParserInstance(command, options);
    
    response.tag = parser.getTag();
    parser.getSpace();
    response.command = parser.getCommand();
    
    if(parser.remainder.length){
        parser.getSpace();
        response.attributes = parser.getAttributes();
    }
    
    return response;
}

function ParserInstance(input, options){
    this.input = (input || "").toString();
    this.options = options || {};
    this.remainder = this.input;
    this.pos = 0;
}

ParserInstance.prototype.getTag = function(){
    if(!this.tag){
        this.tag = this.getElement(formalSyntax["tag"]() + (this.options.allowUntagged ? "*" : ""), true);
    }
    return this.tag;
}

ParserInstance.prototype.getCommand = function(){
    if(!this.command){
        this.command = this.getElement(formalSyntax["command"]());
    }
    return this.command;
}

ParserInstance.prototype.getElement = function(syntax){
    var match, element, errPos;
    if(this.remainder.match(/^\s/)){
        throw new Error("Unexpected whitespace at position " + this.pos);
    }

    if((match = this.remainder.match(/^[^\s]+(?=\s|$)/))){
        element = match[0];

        if((errPos = formalSyntax.verify(element, syntax)) >= 0){
            throw new Error("Unexpected char at position " + (this.pos + errPos))
        }
    }else{
        throw new Error("Unexpected end of input at position " + this.pos);
    }

    this.pos += match[0].length;
    this.remainder = this.remainder.substr(match[0].length);

    return element;
}

ParserInstance.prototype.getSpace = function(){
    if(!this.remainder.length){
        throw new Error("Unexpected end of input at position " + this.pos);   
    }

    if(formalSyntax.verify(this.remainder.charAt(0), formalSyntax.SP()) >= 0){
        throw new Error("Unexpected char at position " + this.pos)
    }

    this.pos ++;
    this.remainder = this.remainder.substr(1);
}

ParserInstance.prototype.getAttributes = function(){
    if(!this.remainder.length){
        throw new Error("Unexpected end of input at position " + this.pos);
    }

    if(this.remainder.match(/^\s/)){
        throw new Error("Unexpected whitespace at position " + this.pos);
    }

    return new TokenParser(this.pos, this.remainder, this.options).getAttributes();
}

function TokenParser(startPos, str, options){
    this.str = (str || "").toString();
    this.options = options || {};

    this.tree = this.currentNode = this.createNode();
    this.pos = startPos || 0;

    this.currentNode.type = "TREE";

    this.state = "NORMAL";

    this.processString();
}

TokenParser.prototype.getAttributes = function(){
    var attributes = [],
        branch = attributes;

    var walk = (function(node){
        var elm, curBranch = branch, partial;

        // If the node was never closed, throw it
        if(!node.closed){
            throw new Error("Unexpected end of input at position " + (this.pos + this.str.length - 1));
        }

        switch(node.type.toUpperCase()){
            case "LITERAL":
            case "STRING":
            case "SEQUENCE":
            case "ATOM":
                elm = {
                    type: node.type.toUpperCase(),
                    value: node.value
                }
                branch.push(elm);
                break;
            case "SECTION":
                branch = branch[branch.length - 1].section = [];
                break;
            case "LIST":
                var elm = [];
                branch.push(elm);
                branch = elm;
                break;
            case "PARTIAL":
                partial = node.value.split(".").map(Number);
                if(partial.slice(-1)[0] < partial.slice(0, 1)[0]){
                    throw new Error("Invalid partial value at position " + node.startPos);
                }
                branch[branch.length - 1].partial = partial;
                break;
        };

        node.childNodes.forEach(function(childNode){
            walk(childNode);
        });
        branch = curBranch;
    }).bind(this);

    walk(this.tree);

    return attributes;
}

TokenParser.prototype.createNode = function(parentNode, startPos){
    var node = {
        childNodes:[],
        type: false,
        value: "",
        closed: true
    }
    
    if(parentNode){
        node.parentNode = parentNode;
    }

    if(typeof startPos == "number"){
        node.startPos = startPos;
    }

    if(parentNode){
        parentNode.childNodes.push(node);
    }

    return node;
}

TokenParser.prototype.processString = function(){
    var chr, i, len,
        checkSP = (function(){
            if(i < len - 1){
                if(this.str.charAt(i + 1) == " "){
                    if(i + 1 == len - 1){
                        throw new Error("Unexpected whitespace at position " + (this.pos + i +1));
                    }
                    if(this.str.charAt(i + 2) != ")"){
                        i++;
                    }else{
                        throw new Error("Unexpected whitespace at position " + (this.pos + i + 1));    
                    }
                }else if([")", "<", "]"].indexOf(this.str.charAt(i + 1)) < 0){
                    throw new Error("Unexpected char at position " + (this.pos + i + 1));
                }
            }
        }).bind(this);

    for(i = 0, len = this.str.length; i < len; i++){
        chr = this.str.charAt(i);

        if(chr == " " && i >= this.str.length - 1){
            throw new Error("Unexpected whitespace at position " + this.pos + i);
        }

        switch(this.state){
            
            case "NORMAL":

                switch(chr){

                    // DQUOTE starts a new string
                    case '"':
                        this.currentNode = this.createNode(this.currentNode, this.pos + i);
                        this.currentNode.type = "string";
                        this.state = "STRING";
                        this.currentNode.closed = false;
                        break;

                    // ( starts a new list
                    case "(":
                        this.currentNode = this.createNode(this.currentNode, this.pos + i);
                        this.currentNode.type = "LIST";
                        this.currentNode.closed = false;
                        break;

                    // ) closes a list
                    case ")":
                        if(this.currentNode.type != "LIST"){
                            throw new Error("Unexpected list terminator ) at position " + (this.pos+i))
                        }

                        this.currentNode.closed = true;
                        this.currentNode.endPos = this.pos + i;
                        this.currentNode = this.currentNode.parentNode;

                        checkSP();
                        break;

                    // ] closes section group
                    case "]":
                        if(this.currentNode.type != "SECTION"){
                            throw new Error("Unexpected section terminator ] at position " + (this.pos+i))
                        }
                        this.currentNode.closed = true;
                        this.currentNode.endPos = this.pos + i;
                        this.currentNode = this.currentNode.parentNode;
                        checkSP();
                        break;

                    // < starts a new partial
                    case "<":
                        // Partial is only allowed after []
                        if(this.str.charAt(i - 1) != "]"){
                            throw new Error("Unexpected partial char < at position " + this.pos);
                        }
                        this.currentNode = this.createNode(this.currentNode, this.pos + i);
                        this.currentNode.type = "PARTIAL";
                        this.state = "PARTIAL";
                        this.currentNode.closed = false;
                        break;

                    // { starts a new literal
                    case "{":
                        this.currentNode = this.createNode(this.currentNode, this.pos + i);
                        this.currentNode.type = "LITERAL";
                        this.state = "LITERAL";
                        this.currentNode.closed = false;
                        break;

                    // ( starts a new sequence
                    case "*":
                        this.currentNode = this.createNode(this.currentNode, this.pos + i);
                        this.currentNode.type = "SEQUENCE";
                        this.currentNode.value = chr;
                        this.currentNode.closed = false;
                        this.state = "SEQUENCE";
                        break;

                    // normally a space should never occur
                    case " ":
                        throw new Error("Unexpected whitespace at position " + (this.pos+i));
                        break;

                    // Any ATOM supported char starts a new Atom sequence, otherwise throw an error
                    default:
                        // Allow \ as the first char for atom to support system flags
                        if(formalSyntax["ATOM-CHAR"]().indexOf(chr) < 0 && chr != "\\"){
                            throw new Error("Unexpected char at position " + (this.pos + i));
                        }

                        this.currentNode = this.createNode(this.currentNode, this.pos + i);
                        this.currentNode.type = "ATOM";
                        this.currentNode.value = chr;
                        this.state = "ATOM";
                        break;
                }
                break;

            case "ATOM":
                
                // space finishes an atom
                if(chr == " "){
                    if([")", "]"].indexOf(this.str.charAt(i + 1)) >= 0){
                        throw new Error("Unexpected whitespace at position " + (this.pos + i + 1));
                    }
                    this.currentNode.endPos = this.pos + i - 1;
                    this.currentNode = this.currentNode.parentNode;
                    this.state = "NORMAL";
                    break;
                }

                // 
                if(
                  this.currentNode.parentNode && 
                  (
                    (chr == ")" && this.currentNode.parentNode.type == "LIST") ||
                    (chr == "]" && this.currentNode.parentNode.type == "SECTION")
                  )
                ){
                    this.currentNode.endPos = this.pos + i - 1;
                    this.currentNode = this.currentNode.parentNode;

                    this.currentNode.closed = true;
                    this.currentNode.endPos = this.pos + i;
                    this.currentNode = this.currentNode.parentNode;
                    this.state = "NORMAL";

                    checkSP();
                    break;
                }

                if((chr=="," || chr==":") && this.currentNode.value.match(/^\d+$/)){
                    this.currentNode.type = "SEQUENCE";
                    this.currentNode.closed = true;
                    this.state = "SEQUENCE";
                }

                // [ starts a section group for this element
                if(chr=="["){
                    // allowed only for slelected elements
                    if(this.options.allowSection.indexOf(this.currentNode.value.toUpperCase()) < 0){
                        throw new Error("Unexpected section start char [ at position " + this.pos);
                    }
                    this.currentNode.endPos = this.pos + i;
                    this.currentNode = this.createNode(this.currentNode.parentNode, this.pos + i);
                    this.currentNode.type = "SECTION";
                    this.currentNode.closed = false;
                    this.state = "NORMAL";
                    break;
                }

                if(chr == "<"){
                    throw new Error("Unexpected start of partial at position " + this.pos);
                }

                // if the char is not ATOM compatible, throw
                if(formalSyntax["ATOM-CHAR"]().indexOf(chr) < 0){
                    throw new Error("Unexpected char at position " + (this.pos+i));
                }

                this.currentNode.value += chr;
                break;

            case "STRING":

                // DQUOTE ends the string sequence
                if(chr == '"'){
                    this.currentNode.endPos = this.pos + i;
                    this.currentNode.closed = true;
                    this.currentNode = this.currentNode.parentNode;
                    this.state = "NORMAL";

                    checkSP();
                    break;
                }

                // \ Escapes the following char
                if(chr == "\\"){
                    i++;
                    if(i>=len){
                        throw new Error("Unexpected end of input at position " + (this.pos + i));
                    }
                }

                if(formalSyntax["TEXT-CHAR"]().indexOf(chr) < 0){
                    throw new Error("Unexpected char at position " + (this.pos+i));
                }

                this.currentNode.value += chr;
                break;

            case "PARTIAL":
                if(chr == ">"){
                    if(this.currentNode.value.substr(-1) == "."){
                        throw new Error("Unexpected end of partial at position " + this.pos);
                    }
                    this.currentNode.endPos = this.pos + i;
                    this.currentNode.closed = true;
                    this.currentNode = this.currentNode.parentNode;
                    this.state = "NORMAL";
                    checkSP();
                    break;
                }
                
                if(chr=="." && (!this.currentNode.value.length || this.currentNode.value.match(/\./))){
                    throw new Error("Unexpected partial separator . at position "+ this.pos);
                }
                
                if(formalSyntax["DIGIT"]().indexOf(chr) < 0 && chr != "."){
                    throw new Error("Unexpected char at position " + (this.pos+i));
                }

                if(this.currentNode.value.match(/^0$|\.0$/) && chr != "."){
                    throw new Error("Invalid partial at position " + (this.pos + i));
                }

                this.currentNode.value += chr;
                break;

            case "LITERAL":
                if(this.currentNode.started){
                    //if(formalSyntax["CHAR8"]().indexOf(chr) < 0){
                    if(chr == "\u0000"){
                        throw new Error("Unexpected \\x00 at position " + (this.pos + i));
                    }
                    this.currentNode.value += chr;

                    if(this.currentNode.value.length >= this.currentNode.literalLength){
                        this.currentNode.endPos = this.pos + i;
                        this.currentNode.closed = true;
                        this.currentNode = this.currentNode.parentNode;
                        this.state = "NORMAL";
                        checkSP();
                    }
                    break;
                }
                
                if(chr == "+" && this.options.literalPlus){
                    this.currentNode.literalPlus = true;
                    break;
                }

                if(chr == "}"){
                    if(!("literalLength" in this.currentNode)){
                        throw new Error("Unexpected literal prefix end char } at position " + (this.pos + i));
                    }
                    if(this.str.charAt(i+1) == "\n"){
                        i++;
                    }else if(this.str.charAt(i+1) == "\r" && this.str.charAt(i+2) == "\n"){
                        i += 2;
                    }else{
                        throw new Error("Unexpected char at position " + (this.pos + i));
                    }
                    this.currentNode.literalLength = Number(this.currentNode.literalLength);
                    this.currentNode.started = true;
                    break;
                }
                if(formalSyntax["DIGIT"]().indexOf(chr) < 0){
                    throw new Error("Unexpected char at position " + (this.pos + i));
                }
                if(this.currentNode.literalLength == "0"){
                    throw new Error("Invalid literal at position " + (this.pos + i));
                }
                this.currentNode.literalLength = (this.currentNode.literalLength || "") + chr;
                break;

            case "SEQUENCE":
                // space finishes the sequence set
                if(chr == " "){
                    if(!this.currentNode.value.substr(-1).match(/\d/) && this.currentNode.value.substr(-1) != "*"){
                        throw new Error("Unexpected whitespace at position " + (this.pos + i));
                    }

                    if(this.currentNode.value.substr(-1) == "*" && this.currentNode.value.substr(-1) != ":"){
                        throw new Error("Unexpected whitespace at position " + (this.pos + i));
                    }

                    this.currentNode.closed = true;
                    this.currentNode.endPos = this.pos + i - 1;
                    this.currentNode = this.currentNode.parentNode;
                    this.state = "NORMAL";
                    break;
                }
                
                if(chr == ":"){
                    if(!this.currentNode.value.substr(-1).match(/\d/) && this.currentNode.value.substr(-1) != "*"){
                        throw new Error("Unexpected range separator : at position " + (this.pos + i));
                    }
                }else if(chr == "*"){
                    if([",", ":"].indexOf(this.currentNode.value.substr(-1)) < 0) {
                        throw new Error("Unexpected range wildcard at position " + (this.pos + i));
                    }
                }else if(chr == ","){
                    if(!this.currentNode.value.substr(-1).match(/\d/) && this.currentNode.value.substr(-1) != "*"){
                        throw new Error("Unexpected sequence separator , at position " + (this.pos + i));
                    }
                    if(this.currentNode.value.substr(-1) == "*" && this.currentNode.value.substr(-2, 1) != ":"){
                        throw new Error("Unexpected sequence separator , at position " + (this.pos + i));
                    }
                }else if(!chr.match(/\d/)){
                    throw new Error("Unexpected char at position " + (this.pos + i));
                }

                if(chr.match(/\d/) && this.currentNode.value.substr(-1) == "*"){
                    throw new Error("Unexpected number at position " + (this.pos + i));
                }

                this.currentNode.value += chr;
                break;
        }
    }
}
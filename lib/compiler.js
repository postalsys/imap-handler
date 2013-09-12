"use strict";

var formalSyntax = require("./formal");

/**
 * Compiles an input object into
 */
module.exports = function(response){
    var resp = response.tag + (response.command ? " " + response.command : ""),
        val, lastType,
        walk = function(node){

            if(lastType == "LITERAL" || ["(", "<", "["].indexOf(resp.substr(-1)) < 0){
                resp += " ";
            }

            if(Array.isArray(node)){
                lastType = "LIST";
                resp += "(";
                node.forEach(walk);
                resp += ")";
                return;
            }

            if(!node && typeof node != "string" && typeof node != "number"){
                resp += "NIL";
                return;
            }

            if(typeof node == "string"){
                resp += JSON.stringify(node);
                return;
            }

            if(typeof node == "number"){
                resp += Math.round(node) || 0; // Only integers allowed
                return;
            }

            lastType = node.type;
            switch(node.type.toUpperCase()){
                case "LITERAL":
                    if(!node.value){
                        resp += "{0}\r\n";
                    }else{
                        resp += "{" + node.value.length + "}\r\n" + node.value;
                    }
                    break;

                case "STRING":
                    resp += JSON.stringify(node.value || "");
                    break;

                case "TEXT":
                case "SEQUENCE":
                    resp += node.value || "";
                    break;

                case "NUMBER":
                    resp += (node.value || 0);
                    break;

                case "ATOM":
                case "SECTION":
                    val = node.value || "";

                    if(formalSyntax.verify(val.charAt(0) == "\\" ? val.substr(1) : val, formalSyntax["ATOM-CHAR"]()) >= 0){
                        val = JSON.stringify(val);
                    }

                    resp += val;

                    if(node.section){
                        resp+="[";
                        node.section.forEach(walk);
                        resp+="]";
                    }
                    if(node.partial){
                        resp+="<" + node.partial.join(".") + ">";
                    }
                    break;
            }

        };

    [].concat(response.attributes || []).forEach(walk);

    return resp;
};

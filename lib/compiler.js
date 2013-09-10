
/**
 * Compiles an input object into 
 */
module.exports = function(response){
    var resp = response.tag + " " + response.command,
        lastType,
        walk = function(node){

            if(lastType == "LITERAL" || ["(", "<", "["].indexOf(resp.substr(-1)) < 0){
                resp += " ";
            }

            if(Array.isArray(node)){
                lastType = "LIST";
                resp += "(";
                node.forEach(walk);
                resp += ")";
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

                case "NUMBER":
                    resp += (node.value || 0);
                    break;

                case "ATOM":    
                case "SECTION":
                    resp += (node.value || "");
                    
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

    [].concat(response.attributes || []).forEach(walk)

    return resp;
}
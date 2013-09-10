var imapHandler = require("./index");

var parsed = imapHandler.parser("A1 FETCH (BODY[HEADER.FIELDS ({4}\r\nDate Subject)]<12.45> UID)")
console.log(JSON.stringify(parsed, false, 4))
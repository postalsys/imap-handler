# IMAP Handler

Parses and compiles IMAP commands. This parser is not suitable for live servers as it requires the entire command (including all literals) to be buffered into one long string before parsing it. It does not tolerate syntax errors as well (an exception is thrown if syntax error occurs). So the module should be suitable for building test IMAP servers.

IMAP Handler parser is not context sensitive, it only makes distinction in data types but not in the values - eg. when an internal date string is expected, the parser identifies this value as a string but does not check if the value has a proper `date-time` format.

Key-value pairs are also not identified, all lists are parsed into arrays, not objects.

## Installation

```
npm install imap-handler
```

## Usage

### Parse IMAP commands

To parse a command you need to have the command as one complete string (including all literals) without the ending &lt;CR&gt;&lt;LF&gt;

    imapHandler.parser(imapCommand);

Where

  * **imapCommand** is an IMAP string without the final line break

The function return an object in the following form:

```
{
    tag: "TAG",
    command: "COMMAND",
    attributes: [
        {type: "ATOM", value: "atom", section:[section_elements], partial: [start, end]},
        {type: "STRING", value: "string"},
        {type: "LITERAL", value: "literal"},
        {type: "NUMBER", value: 123},
        [list_elements]
    ]
}
```

If section or partial values are not specified in the command, the values are also missing from the ATOM element

For example

```javascript
var imapHandler = require("imap-handler");

var parsed = imapHandler.parser("A1 FETCH (BODY[HEADER.FIELDS ({4}\r\nDate Subject)]<12.45> UID)");
```

Results in the following value:

```json
{
    "tag": "A1",
    "command": "FETCH",
    "attributes": [
        [
            {
                "type": "ATOM",
                "value": "BODY",
                "section": [
                    {
                        "type": "ATOM",
                        "value": "HEADER.FIELDS"
                    },
                    [
                        {
                            "type": "LITERAL",
                            "value": "Date"
                        },
                        {
                            "type": "ATOM",
                            "value": "Subject"
                        }
                    ]
                ],
                "partial": [
                    12,
                    45
                ]
            },
            {
                "type": "ATOM",
                "value": "UID"
            }
        ]
    ]
}
```

### Compile command objects into IMAP commands

You can "compile" parsed or self generated IMAP command obejcts to IMAP command strings with

    imapHandler.compiler(commandObject);

Where

  * **commandObject** is an object parsed with `imapHandler.parser()` or self generated

The function returns a string

For example

```javascript
var command = {
    tag: "*", 
    command: "OK", 
    attributes: [
        {
            type: "SECTION", 
            section: [
                {type: "ATOM", value: "ALERT"}
            ]
        },
        {type:"ATOM", value: "NB! The server is shutting down"}
    ]
};

imapHandler.compiler(command);
// * OK [ALERT] NB! The server is shutting down
```

## License

**MIT**
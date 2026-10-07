# IMAP Handler

[![Run Tests](https://github.com/postalsys/imap-handler/actions/workflows/test.yml/badge.svg)](https://github.com/postalsys/imap-handler/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/imap-handler)](https://www.npmjs.com/package/imap-handler)
[![license](https://img.shields.io/npm/l/imap-handler)](https://github.com/postalsys/imap-handler/blob/master/LICENSE)

Parses and compiles IMAP commands. This parser is not suitable for live servers as it requires the entire command (including all literals) to be buffered into one long string before parsing it. It does not tolerate syntax errors as well (an exception is thrown if syntax error occurs). So the module should be suitable for building test IMAP servers.

IMAP Handler parser is not context sensitive, it only makes distinction in data types but not in the values - eg. when an internal date string is expected, the parser identifies this value as a string but does not check if the value has a proper `date-time` format.

Key-value pairs are also not identified, all lists are parsed into arrays, not objects.

## Installation

```
npm install imap-handler
```

IMAP Handler requires Node.js 20 or newer.

> IMAP Handler is maintained by the team behind **[EmailEngine](https://emailengine.app/?utm_source=imap-handler-readme&utm_medium=readme&utm_campaign=oss-docs&utm_content=note)**, a self-hosted email API that turns Gmail, Microsoft 365, and IMAP accounts into REST endpoints, with managed OAuth2 and webhooks for incoming mail. For a full featured IMAP client, see [ImapFlow](https://imapflow.com/).

## Usage

### Parse IMAP commands

To parse a command you need to have the command as one complete string (including all literals) without the ending &lt;CR&gt;&lt;LF&gt;

    imapHandler.parser(imapCommand[, options]);

Where

- **imapCommand** is an IMAP string without the final line break
- **options** is an optional options object (see below)

Options

- **allowUntagged** (Boolean) by default parsing "*" tags are not allowed, set this value to true to accept untagged commands
- **allowSection** (Array) Not all atoms are allowed to have section (and partial) values, set the command names with this array (default value is `["BODY", "BODY.PEEK"]`). Add `"BINARY"`, `"BINARY.PEEK"` and `"BINARY.SIZE"` for the BINARY extension (RFC 3516)
- **multiWords** (Array) commands that are joined with the next word, default value is `["UID", "AUTHENTICATE"]`
- **literalPlus** (Boolean) accept non-synchronizing literals `{n+}` (RFC 7888), and `~{n+}` when `literal8` is set as well (RFC 4466)
- **literal8** (Boolean) accept `~{n}` literals (RFC 3516, RFC 9051), returned as `{type: "LITERAL8", value}` nodes. Unlike a `LITERAL`, the value may contain NUL
- **utf8** (Boolean) accept valid UTF-8 in quoted strings (RFC 9051 and RFC 9755 UTF8=ACCEPT). The value is still returned as a binary string (one char per octet). Invalid UTF-8 (overlong forms, surrogates, truncated sequences, values above U+10FFFF) still throws

The function returns an object in the following form:

```
{
    tag: "TAG",
    command: "COMMAND",
    attributes: [
        {type: "SEQUENCE", value: "sequence-set"},
        {type: "ATOM", value: "atom", section:[section_elements], partial: [start, end]},
        {type: "STRING", value: "string"},
        {type: "LITERAL", value: "literal"},
        {type: "LITERAL8", value: "literal8"},
        [list_elements]
    ]
}
```

Where

- **tag** is a string containing the tag
- **command** is the first element after tag
- **attributes** (if present) is an array of next elements

If section or partial values are not specified in the command, the values are also missing from the ATOM element

**NB!** Sequence numbers are identified as ATOM values if the value contains only numbers or is a single `*`.
**NB!** NIL atoms are always identified as `null` values, even though in some cases it might be an ATOM with value `"NIL"`

Syntax errors throw an `Error` with `code` set to `"ParserError"` (or `"MaxNestingReached"` when lists and sections are nested too deeply) and `pos` set to the position of the error in the input.

For example

```javascript
var imapHandler = require('imap-handler');

imapHandler.parser('A1 FETCH *:4 (BODY[HEADER.FIELDS ({4}\r\nDate Subject)]<12.45> UID)');
```

Results in the following value:

```json
{
    "tag": "A1",
    "command": "FETCH",
    "attributes": [
        [
            {
                "type": "SEQUENCE",
                "value": "*:4"
            },
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
                "partial": [12, 45]
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

    imapHandler.compiler(commandObject[, options]);

Where

- **commandObject** is an object parsed with `imapHandler.parser()` or self generated
- **options** is an optional options object. Set `utf8: true` to write values that are valid UTF-8 as quoted strings instead of literals (RFC 9051, RFC 9755 UTF8=ACCEPT)

The function returns a string.

The input object differs from the parsed object with the following aspects:

- **string**, **number** and **null** (null values are all non-number and non-string falsy values) are allowed to use directly - `{type: "STRING", value: "hello"}` can be replaced with `"hello"`
- Additional types are used: `SECTION` which is an alias for `ATOM` and `TEXT` which returns the input string as given with no modification (useful for server messages).
- `LITERAL8` nodes are written as `~{n}` literals, for example in a FETCH BINARY response (RFC 3516).

Values are treated as binary strings (one character per octet), and `Buffer` values are accepted as well. Strings are written as quoted strings, where only `"` and `\` are escaped. A value that contains CR, LF, NUL or 8-bit characters can not be quoted, so it is written as a literal instead. ATOM values that are not valid atoms are encoded the same way.

List members are separated by a space. A few rules of the IMAP grammar have no space between lists, for example the bodies of a multipart BODYSTRUCTURE (`body-type-mpart = 1*body SP media-subtype`) and the addresses of an ENVELOPE (`env-from = "(" 1*address ")"`). Set `adjacentLists = true` on such an array to write the lists at the start of the array without the space between them:

```javascript
const bodies = [['TEXT', 'PLAIN'], ['TEXT', 'HTML'], 'ALTERNATIVE'];
bodies.adjacentLists = true;
// (("TEXT" "PLAIN")("TEXT" "HTML") "ALTERNATIVE")
```

`TEXT` values, the tag and the command must not contain CR, LF or NUL, `SEQUENCE` values must be valid sequence sets, and every object node needs a known `type`. Otherwise the compiler throws an `Error` with `code` set to `"InvalidTextValue"`, `"InvalidSequenceSet"` or `"InvalidNodeType"`.

For example

```javascript
var command = {
    tag: '*',
    command: 'OK',
    attributes: [
        {
            type: 'SECTION',
            section: [{ type: 'ATOM', value: 'ALERT' }]
        },
        { type: 'TEXT', value: 'NB! The server is shutting down' }
    ]
};

imapHandler.compiler(command);
// * OK [ALERT] NB! The server is shutting down
```

## Development

    npm install
    npm test            # lint + all tests
    npm run test:unit   # tests only
    npm run format      # apply Prettier formatting

## License

Copyright (c) 2013-2026 Postal Systems OÜ

Licensed under the MIT license.

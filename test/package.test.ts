import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// These tests load the compiled output in dist/ (built by the pretest script) through the
// package.json exports map, the way an installed copy of the package is loaded. Node resolves
// the package name to the package itself when the specifier is used from inside the package.
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// a non-literal specifier keeps TypeScript from resolving the built types, dist/ may not exist yet
const packageName: string = 'imap-handler';

const command = 'A1 FETCH 1:* (FLAGS BODY[HEADER.FIELDS (SUBJECT)]<0.10>)';

describe('Built package', () => {
    it('ships both module formats with type declarations', () => {
        for (const format of ['esm', 'cjs']) {
            for (const name of ['index', 'parser', 'compiler', 'formal']) {
                assert.ok(fs.existsSync(path.join(root, 'dist', format, name + '.js')), format + ' ' + name);
                assert.ok(fs.existsSync(path.join(root, 'dist', format, name + '.d.ts')), format + ' ' + name + ' declarations');
            }
        }
    });

    it('keeps the CommonJS shapes', () => {
        const imapHandler = require(packageName);
        assert.deepEqual(Object.keys(imapHandler).sort(), ['compiler', 'parser']);
        assert.equal(imapHandler.default, imapHandler);
        assert.equal(imapHandler.compiler(imapHandler.parser(command)), command);

        const parser = require(packageName + '/lib/parser');
        assert.equal(typeof parser, 'function');
        assert.equal(parser, imapHandler.parser);
        assert.equal(parser.default, parser);
        assert.equal(require(packageName + '/lib/parser.js'), parser);
        assert.equal(require(packageName + '/lib/compiler'), imapHandler.compiler);

        const formal = require(packageName + '/lib/formal');
        assert.equal(formal.tag().indexOf('+'), -1);
        assert.equal(formal.isAtomChar('A'), true);
    });

    it('loads as an ES module', async () => {
        const imapHandler = await import(packageName);
        assert.equal(imapHandler.default.parser, imapHandler.parser);
        assert.equal(imapHandler.compiler(imapHandler.parser(command)), command);

        const { default: parser } = await import(packageName + '/lib/parser');
        assert.equal(parser, imapHandler.parser);
        const { default: formal } = await import(packageName + '/lib/formal');
        assert.equal(formal.isAtomChar('('), false);
    });
});

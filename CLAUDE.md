# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`imap-handler` parses complete IMAP command strings into a structured object and compiles such objects back into IMAP strings. It is not a streaming parser: the whole command, including literals, must be buffered first, and syntax errors throw. It is used by ImapKit (`imapkit` on npm, the IMAP mock server in ../imapkit), so a parser or compiler change can break that consumer. Written in TypeScript under `src/` and published as a dual package (ES modules in `dist/esm/`, CommonJS in `dist/cjs/`, each with type declarations), no runtime dependencies, supports Node.js 20 and newer (CI tests 20, 22 and 24) and the latest Bun and Deno.

## Commands

- `npm test`: ESLint and the type check (`npm run lint`), then all tests (`npm run test:unit`, which builds and runs `node --import tsx --test test/*.test.ts`).
- `npm run build`: `scripts/build.js` compiles `src/` with `tsconfig.esm.json` and `tsconfig.cjs.json` and rewrites the CommonJS modules that only have a default export so that `require()` returns the function or object itself (`require('imap-handler/lib/parser')` is the parser). `dist/` is gitignored, `prepare` builds it on install and publish.
- `npm run test:bun`, `npm run test:deno`: the same tests under Bun and Deno (CI runs both on their latest release).
- Single test file: `node --import tsx --test test/parser.test.ts`. Single test case: add `--test-name-pattern="<test name>"`.
- `npm run lint`, `npm run format` / `npm run format:check` (Prettier: single quotes, 4 spaces, 160 columns). CI fails on unformatted files. `npm install` sets `core.hooksPath` to `.githooks`, whose pre-commit hook runs Prettier on staged files.
- `npm run update`: refresh all dev dependencies to latest (`ncu -u`, config in `.ncurc.js`). Versions are pinned exactly.

ESLint (`eslint.config.js`, with typescript-eslint) enforces `const`/`let` (no `var`), arrow callbacks, one declaration per statement and `===`.

## TypeScript and module format

- Every file under `src/` compiles both as ES module and as CommonJS, so it must not use `import.meta`, `require`, `module`, `exports`, `__dirname`, `__filename`, top-level `await` or JSON imports. Relative imports carry the `.js` extension, builtins use the `node:` prefix.
- `erasableSyntaxOnly` is on (no enums, no parameter properties), `@types/node` stays on the 20.x line (`.ncurc.cjs`) so APIs newer than Node 20 do not type-check.
- `src/parser.ts`, `src/compiler.ts` and `src/formal.ts` have only a default export, keep it that way (the CommonJS shape depends on it, `test/package.test.ts` checks it). `src/index.ts` has the named exports `parser` and `compiler`, its default export is the exports object.
- `package.json` `exports` maps `.`, `./lib/*` and `./lib/*.js` to both builds.

## Releases

Releases are automated with release-please: use Conventional Commit messages (`fix:`, `feat:`, `chore:` ...) on master, merge the release PR it opens, and `.github/workflows/release.yaml` waits for the `test.yml` run on that commit and then publishes to npm through trusted publishing (OIDC, no token). Do not bump `version` in package.json by hand.

## Architecture

- `src/parser.ts`: `ParserInstance` reads the tag, the command (joining `options.multiWords` such as `UID FETCH` into one command) and hands the rest to `TokenParser`, a character-by-character state machine that builds a node tree and then walks it into the plain `attributes` array returned to the caller, with upper-cased types (`ATOM`, `STRING`, `LITERAL`, `LITERAL8`, `SEQUENCE`, `LIST`, `SECTION`, `PARTIAL`). Options: `allowUntagged`, `allowSection`, `multiWords`, `literalPlus`, `literal8` (accept `~{n}`), `utf8` (accept UTF-8 in quoted strings). The default is strict RFC 3501 grammar, extensions are opt-in.
- `src/compiler.ts`: the inverse, turns `{ tag, command, attributes }` back into an IMAP string, choosing quoting or literals per value. It also accepts `TEXT` nodes (written unquoted), which the parser never produces, and `LITERAL8` nodes. The optional second argument `{ utf8: true }` quotes valid UTF-8 values instead of writing literals.
- `src/formal.ts`: RFC 3501 character classes (`ATOM-CHAR`, `DIGIT`, ...) used by both, memoized on first call, plus a `verify` helper.

## Tests

Tests (`test/*.test.ts`) use `node:test` and `node:assert` and are synchronous, and import from `../src/index.js`. `test/package.test.ts` loads the built `dist/` through the `exports` map. Parse failures are asserted with `assert.throws(() => parser(...))`; do not use the `try { ...; assert.ok(false) } catch {}` pattern, since the catch would swallow the assertion failure.

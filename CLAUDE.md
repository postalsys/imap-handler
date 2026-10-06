# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`imap-handler` parses complete IMAP command strings into a structured object and compiles such objects back into IMAP strings. It is not a streaming parser: the whole command, including literals, must be buffered first, and syntax errors throw. It is used by hoodiecrow-imap (the IMAP mock server), so a parser or compiler change can break that consumer. CommonJS, no runtime dependencies, supports Node.js 20 and newer (CI tests 20, 22 and 24).

## Commands

- `npm test`: ESLint, then all tests (`npm run test:unit`, which is `node --test test/*.js`).
- Single test file: `node --test test/parser.js`. Single test case: add `--test-name-pattern="<test name>"`.
- `npm run lint`, `npm run format` / `npm run format:check` (Prettier: single quotes, 4 spaces, 160 columns). CI fails on unformatted files. `npm install` sets `core.hooksPath` to `.githooks`, whose pre-commit hook runs Prettier on staged files.
- `npm run update`: refresh all dev dependencies to latest (`ncu -u`, config in `.ncurc.js`). Versions are pinned exactly.

ESLint (`eslint.config.js`) enforces `const`/`let` (no `var`), arrow callbacks, one declaration per statement, `===`, and global `'use strict'`.

## Releases

Releases are automated with release-please: use Conventional Commit messages (`fix:`, `feat:`, `chore:` ...) on master, merge the release PR it opens, and `.github/workflows/release.yaml` waits for the `test.yml` run on that commit and then publishes to npm through trusted publishing (OIDC, no token). Do not bump `version` in package.json by hand.

## Architecture

- `lib/parser.js`: `ParserInstance` reads the tag, the command (joining `options.multiWords` such as `UID FETCH` into one command) and hands the rest to `TokenParser`, a character-by-character state machine that builds a node tree and then walks it into the plain `attributes` array returned to the caller, with upper-cased types (`ATOM`, `STRING`, `LITERAL`, `SEQUENCE`, `LIST`, `SECTION`, `PARTIAL`). Options: `allowUntagged`, `allowSection`, `multiWords`, `literalPlus`.
- `lib/compiler.js`: the inverse, turns `{ tag, command, attributes }` back into an IMAP string, choosing quoting or literals per value. It also accepts `TEXT` nodes (written unquoted), which the parser never produces.
- `lib/formal.js`: RFC 3501 character classes (`ATOM-CHAR`, `DIGIT`, ...) used by both, memoized on first call, plus a `verify` helper.

## Tests

Tests use `node:test` and `node:assert` and are synchronous. Parse failures are asserted with `assert.throws(() => parser(...))`; do not use the `try { ...; assert.ok(false) } catch {}` pattern, since the catch would swallow the assertion failure.

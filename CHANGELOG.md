# Changelog

## [1.3.2](https://github.com/postalsys/imap-handler/compare/v1.3.1...v1.3.2) (2026-10-07)


### Bug Fixes

* **parser:** parse digit-led atoms that are not sequence sets as ATOM ([e6f0746](https://github.com/postalsys/imap-handler/commit/e6f074645e59144c1655f3159f5625d00d7cbef3))
* **parser:** parse digit-led atoms that are not sequence sets as ATOM ([fadca87](https://github.com/postalsys/imap-handler/commit/fadca8778c1e29a8776bdb6549026e1a8d8334f5)), closes [#11](https://github.com/postalsys/imap-handler/issues/11)

## [1.3.1](https://github.com/postalsys/imap-handler/compare/v1.3.0...v1.3.1) (2026-10-07)


### Bug Fixes

* **parser:** accept atom chars in command names ([3d0af6d](https://github.com/postalsys/imap-handler/commit/3d0af6dc0019f3e84fb47e49bad815cfd3187fa6))
* **parser:** accept atom chars in command names ([3560971](https://github.com/postalsys/imap-handler/commit/3560971c0fc7ec5fa8a946b07d66f60ace6ddceb)), closes [#1](https://github.com/postalsys/imap-handler/issues/1)

## [1.3.0](https://github.com/postalsys/imap-handler/compare/v1.2.0...v1.3.0) (2026-10-07)


### Features

* **parser:** add a number64 option for literal sizes and partial ranges ([899a08f](https://github.com/postalsys/imap-handler/commit/899a08f10c68e4882b62b7e59ccbed88548c610b))
* **parser:** add a number64 option for literal sizes and partial ranges ([42b6ba1](https://github.com/postalsys/imap-handler/commit/42b6ba1ee80f0b401d4901941adfba833e8d167d))

## [1.2.0](https://github.com/postalsys/imap-handler/compare/v1.1.0...v1.2.0) (2026-10-07)


### Features

* **parser:** opt-in literal8 and UTF-8 quoted strings ([676ed60](https://github.com/postalsys/imap-handler/commit/676ed60fe49167cb56cb0ce144a260eed43d9095))
* **parser:** opt-in literal8 and UTF-8 quoted strings ([047eb92](https://github.com/postalsys/imap-handler/commit/047eb925bc4ef05c2ba218c4f7df88f78a40fd6e))

## [1.1.0](https://github.com/postalsys/imap-handler/compare/v1.0.1...v1.1.0) (2026-10-07)


### Features

* **compiler:** write adjacent lists without a space where the grammar has none ([9e2d37d](https://github.com/postalsys/imap-handler/commit/9e2d37d8a2365dbbace33542df364e9930c8d800))

## [1.0.1](https://github.com/postalsys/imap-handler/compare/v1.0.0...v1.0.1) (2026-10-07)


### Bug Fixes

* allow only 0-9 in DIGIT ([e6266e9](https://github.com/postalsys/imap-handler/commit/e6266e90b02580a66f1e2c53646b7491f5548de4))
* **compiler:** quote values per RFC 3501 and refuse unsafe output ([7bade8c](https://github.com/postalsys/imap-handler/commit/7bade8ca575349ba7ed41096a7ebd5122c5b080f))
* **parser:** follow RFC 3501 grammar for sets, strings, literals and partials ([89b0b8a](https://github.com/postalsys/imap-handler/commit/89b0b8a41ec9150180d20715dc1859da098ab74d))

## [1.0.0](https://github.com/postalsys/imap-handler/compare/v0.1.12...v1.0.0) (2026-10-06)


### ⚠ BREAKING CHANGES

* Node.js 20 or newer is required.

### Features

* modernize for Node.js 20+ ([5c9f48a](https://github.com/postalsys/imap-handler/commit/5c9f48ac791c3f44ec5265fec971be6199524c2d))

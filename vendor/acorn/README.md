# Acorn 8.17.0 (MIT)

`acorn.js` is the unmodified Acorn distribution bundled in official Node.js
v24.19.0 at `internal/deps/acorn/acorn/dist/acorn`. The included MIT license is
reproduced from Node.js's third-party license notice for Acorn. The parser has no
runtime network or package dependency.

- Upstream: https://github.com/acornjs/acorn
- Node.js source: https://github.com/nodejs/node/tree/v24.19.0/deps/acorn
- SHA-256: `b373ccd10e9deb63654289f73216eeefcaf0405d9ee24289aabf596b91b4c318`

With official Node.js v24.19.0, reproduce or check these bytes from the project
root with `node tools/vendor-acorn.cjs` or `node tools/vendor-acorn.cjs --check`.
The helper refuses any parser whose checksum is different. It extracts source
text only; it does not evaluate the source.

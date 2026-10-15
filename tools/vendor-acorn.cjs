#!/usr/bin/env node
'use strict';
// Reproduces the parser distributed by official Node.js v24.19.0.
// No code is executed from the captured parser during extraction.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const expected = 'b373ccd10e9deb63654289f73216eeefcaf0405d9ee24289aabf596b91b4c318';
const source = process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
if (typeof source !== 'string' || crypto.createHash('sha256').update(source).digest('hex') !== expected) {
  throw new Error('Use official Node.js v24.19.0 with the pinned Acorn 8.17.0 source. The parser checksum did not match.');
}
const destination = path.join(__dirname, '..', 'vendor', 'acorn', 'acorn.js');
fs.mkdirSync(path.dirname(destination), { recursive: true });
if (process.argv.includes('--check')) {
  if (fs.readFileSync(destination, 'utf8') !== source) throw new Error('Vendored parser differs from its pinned source.');
  console.log('Vendored Acorn 8.17.0 matches its pinned source.');
} else {
  fs.writeFileSync(destination, source);
  console.log('Wrote ' + destination);
}

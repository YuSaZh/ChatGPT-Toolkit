#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const { createMetadataTransformer } = require(path.join(root, 'module-metadata-transform.cjs'));
const canonical = value => value.replace(/\r\n/g, '\n');
const parser = canonical(fs.readFileSync(path.join(root, 'vendor', 'acorn', 'acorn.js'), 'utf8'));
const expected = 'b373ccd10e9deb63654289f73216eeefcaf0405d9ee24289aabf596b91b4c318';
if (crypto.createHash('sha256').update(parser).digest('hex') !== expected) throw new Error('Unexpected vendored parser bytes.');
const license = canonical(fs.readFileSync(path.join(root, 'vendor', 'acorn', 'LICENSE'), 'utf8'));
const bundle = '/*\n * Acorn 8.17.0; bundled without modification.\n' + license.split('\n').map(line => ' * ' + line).join('\n') + '\n */\n(function () {\n  const exports = {};\n  const module = { exports };\n' + parser + '\n  return (' + canonical(createMetadataTransformer.toString()) + ')(module.exports);\n})()\n';
const destination = path.join(root, 'module-metadata-transform.browser.js');
if (process.argv.includes('--check')) {
  if (canonical(fs.readFileSync(destination, 'utf8')) !== bundle) throw new Error('Browser transformer is stale; run node tools/build-metadata-transform.cjs.');
  console.log('Browser transformer matches the checked-in source.');
} else {
  fs.writeFileSync(destination, bundle);
  console.log('Wrote ' + destination + ' (' + Buffer.byteLength(bundle) + ' bytes).');
}

'use strict';
const fs = require('node:fs'), path = require('node:path');
const base = path.join(__dirname, '..'), file = path.join(base, 'chatgpt-pro-counter.user.js');
const transformer = fs.readFileSync(path.join(base, 'module-metadata-transform.browser.js'), 'utf8').trim();
const { pageMetadataRuntime } = require(path.join(base, 'metadata-page-runtime.cjs'));
const { startPageMetadataBridge } = require(path.join(base, 'metadata-page-bootstrap.cjs'));
const begin = '  // BEGIN GENERATED PASSIVE METADATA RUNTIME', end = '  // END GENERATED PASSIVE METADATA RUNTIME';
const block = [begin, '  // Bundles Acorn 8.17.0, MIT; see vendor/acorn/LICENSE. No external runtime downloads.', '  const metadataTransformerSource = ' + JSON.stringify(transformer) + ';', pageMetadataRuntime.toString(), startPageMetadataBridge.toString(), end].join('\n');
let source = fs.readFileSync(file, 'utf8');
if (source.includes(begin)) source = source.slice(0,source.indexOf(begin)) + block + source.slice(source.indexOf(end)+end.length);
else source = source.replace('  function boot() {', () => block + '\n  function boot() {');
if (process.argv.includes('--check')) { if (source !== fs.readFileSync(file,'utf8')) { console.error('Generated metadata runtime is stale'); process.exitCode=1; } }
else fs.writeFileSync(file,source);

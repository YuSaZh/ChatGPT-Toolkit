'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { buildSync } = require('esbuild');
const toolkitApi = require('../../chatgpt-pro-counter.user.js');
(async () => {
  const script = buildSync({
    entryPoints: [path.join(__dirname, './fixture.cjs')], bundle: true,
    write: false, platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }
  }).outputFiles[0].text;
  for (const cacheKind of ['query', 'external']) {
  // No resource loading is enabled. No live site, account or ChatGPT API is used.
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://fixture.invalid/c/chat-a', runScripts: 'outside-only', pretendToBeVisual: true
  });
  let requests = 0;
  const blocked = () => { requests++; throw Error('Unexpected test network request'); };
  dom.window.fetch = blocked;
  dom.window.XMLHttpRequest = class { constructor() { blocked(); } };
  dom.window.WebSocket = class { constructor() { blocked(); } };
  dom.window.toolkitApi = toolkitApi;
  dom.window.cacheKind = cacheKind;
  try {
    // Evaluate only the local bundle created immediately above.
    dom.window.eval(script);
    const api = dom.window.fixtureApi;
    const committed = [api.inspect()];
    for (let i = 0; i < 5; i++) committed.push(api.bump());
    assert.ok(committed.every(row => row.oldAncestors > 0));
    api.suspend();
    let suspended;
    const deadline = Date.now() + 5000;
    do {
      await new Promise(resolve => setTimeout(resolve, 10));
      suspended = api.inspect();
    } while (suspended.renderCount === committed.at(-1).renderCount && Date.now() < deadline);
    assert.ok(suspended.renderCount > committed.at(-1).renderCount, 'transition actually rendered');
    assert.equal(suspended.oldAncestors, 0, '1.1.15 incorrectly rejects still-mounted history during pending concurrent render');
    const recovered = api.cancel();
    assert.ok(recovered.oldAncestors > 0, 'completed commit repairs ordinary return ancestry');
    for (const row of [...committed, suspended, recovered]) {
      assert.equal(row.sameConnectedHost, true);
      assert.equal(row.inspectionSnapshotCalls, 0, 'Toolkit does not invoke the application snapshot function');
      assert.equal(row.boundaryCount, 1, 'memoized message boundary reused');
      assert.ok(row.canonicalAncestors > 0);
      assert.equal(row.targets, 2);
      assert.equal(row.labels, 2);
      assert.match(row.text, /real-react-model/);
    }
    assert.equal(requests, 0);
    console.log(JSON.stringify({ passed: true, cacheKind, requests, initial: committed[0], suspended, recovered }, null, 2));
    api.unmount();
  } finally { dom.window.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

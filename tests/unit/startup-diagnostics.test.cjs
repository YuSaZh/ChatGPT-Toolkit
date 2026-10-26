'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { environment } = require('../fixtures/audit-dom-fixture.cjs');
const menu = (env, label) => {
  const item = env.menus.find(value => value.label === label);
  assert.ok(item, label + ' is registered');
  return item;
};
const report = env => {
  menu(env, '诊断 Pro 计数器').fn();
  assert.ok(env.alerts.length, 'diagnostics can be read without the main UI');
  return env.alerts.at(-1);
};

test('diagnostic and display menus survive a failure during the application factory', () => {
  const env = environment({ beforeRun({ context }) {
    context.Set = class { constructor() { throw Error('SENSITIVE-SYNTHETIC-FACTORY-DETAIL'); } };
  } });
  menu(env, '显示 Pro 计数器');
  assert.equal(env.host(), null);
  const text = report(env);
  assert.ok(text.length > 0);
  assert.ok(!text.includes('SENSITIVE-SYNTHETIC-FACTORY-DETAIL'), 'raw exceptions are not exposed');
});

test('diagnostic report omits credentials, configured URLs, and stored user labels', () => {
  const env = environment({ entries: [
    ['gpc.v1.webdav', { url: 'https://private-server.invalid/secret-location.json', username: 'SYNTHETIC-USER-PRIVATE', password: 'SYNTHETIC-SECRET-PRIVATE', enabled: false, interval: 0 }],
    ['gpc.v1.settings.synthetic', { v: 1, id: 'synthetic', updated: Date.now(), cap: 100, mode: 'fixed', anchor: Date.now(), ledger: 'default', label: 'SYNTHETIC-LABEL-PRIVATE' }],
  ] });
  const text = report(env);
  assert.doesNotMatch(text, /private-server|secret-location|SYNTHETIC-USER-PRIVATE|SYNTHETIC-SECRET-PRIVATE|SYNTHETIC-LABEL-PRIVATE/);
});

test('missing menu API does not suppress the launcher', () => {
  const env = environment({ beforeRun({ context }) { delete context.GM_registerMenuCommand; } });
  assert.ok(env.rendered());
  assert.deepEqual(env.errors, []);
});

test('throwing menu API does not suppress the launcher', () => {
  const env = environment({ beforeRun({ context }) {
    context.GM_registerMenuCommand = () => { throw Error('Synthetic menu failure'); };
  } });
  assert.ok(env.rendered());
  assert.deepEqual(env.errors, []);
});

test('a one-time Shadow DOM failure recovers without retaining an incomplete host', () => {
  const env = environment({ beforeRun({ Node }) {
    const attach = Node.prototype.attachShadow;
    let first = true;
    Node.prototype.attachShadow = function (...args) {
      if (first) { first = false; throw Error('Synthetic shadow failure'); }
      return attach.apply(this, args);
    };
  } });
  env.tick();
  assert.ok(env.rendered());
  assert.equal(env.document.querySelectorAll('#chatgpt-pro-local-counter').length, 1);
  assert.deepEqual(env.errors, []);
});

test('a one-time initial renderer failure retries until a usable launcher exists', () => {
  const env = environment({ beforeRun({ document }) {
    const create = document.createElement;
    let first = true;
    document.createElement = tag => {
      if (tag === 'button' && first) { first = false; throw Error('Synthetic first-render failure'); }
      return create(tag);
    };
  } });
  env.tick();
  assert.ok(env.rendered());
  assert.equal(env.document.querySelectorAll('#chatgpt-pro-local-counter').length, 1);
  assert.equal(env.document.listeners.pointerover?.length, 1, 'hover behavior is initialized after recovery');
  env.tick();
  assert.equal(env.document.listeners.pointerover?.length, 1, 'repeated recovery checks do not duplicate hover listeners');
  assert.deepEqual(env.errors, []);
});

test('early menus are available before the document body arrives', () => {
  const env = environment({ bodyAbsent: true });
  menu(env, '显示 Pro 计数器');
  assert.ok(report(env).length > 0);
  assert.equal(env.host(), null);
  env.document.body = new env.Node('body');
  env.document.documentElement.appendChild(env.document.body);
  env.mutate();
  assert.ok(env.rendered());
});

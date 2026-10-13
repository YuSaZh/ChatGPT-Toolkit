'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'chatgpt-pro-counter.user.js'), 'utf8');
const header = source.match(/^\/\/ ==UserScript==\n([\s\S]*?)\/\/ ==\/UserScript==/)[1];
const values = key => [...header.matchAll(new RegExp('^// @' + key + '\\s+(.+)$', 'gm'))].map(match => match[1].trim());
const raw = 'https://raw.githubusercontent.com/YuSaZh/GPT-Pro-Counter/main/chatgpt-pro-counter.user.js';

test('release preserves script identity and persistent v1 storage namespace', () => {
  assert.deepEqual(values('name'), ['ChatGPT Pro 本机计数器']);
  assert.deepEqual(values('namespace'), ['local.chatgpt.pro-counter']);
  assert.equal(require('./chatgpt-pro-counter.user.js').PREFIX, 'gpc.v1.');
});

test('release uses versioned GitHub update and install metadata', () => {
  assert.deepEqual(values('version'), ['1.1.3']);
  assert.deepEqual(values('updateURL'), [raw]);
  assert.deepEqual(values('downloadURL'), [raw]);
  assert.deepEqual(values('homepageURL'), ['https://github.com/YuSaZh/GPT-Pro-Counter']);
  assert.deepEqual(values('supportURL'), ['https://github.com/YuSaZh/GPT-Pro-Counter/issues']);
});

test('release remains restricted to ChatGPT pages without remote runtime dependencies', () => {
  assert.deepEqual(values('match'), ['https://chatgpt.com/*', 'https://chat.openai.com/*']);
  assert.deepEqual(values('require'), []);
  assert.deepEqual(values('license'), ['MIT']);
});

test('installation documentation points at the published raw script', () => {
  for (const name of ['README.md', 'README.zh-CN.md']) {
    const text = fs.readFileSync(path.join(__dirname, name), 'utf8');
    assert.ok(text.includes(raw), name);
    assert.doesNotMatch(text, /待上传|安装入口待上线/);
  }
});

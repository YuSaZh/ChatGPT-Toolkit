'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const transform = require('../../src/metadata/module-metadata-transform.cjs');

const CONTENT = `var S=r("selectors");e.read=(get,cid)=>{let value=get(S.mapping,cid);return {mapping:value,context_truncation_continuation:null,getRenderTelemetry:null,isStreaming:false}};`;
const MESSAGE = `var R=r("react"),J=r("jsx");
function User(props){e.calls.push(["user",this,props]);return {kind:"native-user",props}};
function Actions(props){e.calls.push(["assistant",this,props]);return {kind:"native-actions",props}};
function State(){return (0,R.useState)(0)}
e.copyPlainTextFromSource=0;e.suppressCopyTurnToClipboardAnalytics=0;e.getCopyHtml=0;
e.renderUser=props=>(0,J.jsx)(User,{item:props.item,items:props.items,isMostRecentTurn:true,isReadOnly:false});
e.renderActions=props=>(0,J.jsxs)(Actions,{assistantItem:props.item,additionalTurnActions:[],actionRowRef:null});
e.getUser=()=>User;e.getActions=()=>Actions;`;
const BOUNDARY = `var R=r("react");r.d(e,{render:()=>Turns});function Turns(props){e.calls.push([this,props]);return {timestampSeparatorAtMs:(0,R.useMemo)(()=>props.time,[]),id:"pending-chatgpt-submit"}}`;

function factory(body, shape = 'arrow') {
  if (shape === 'method') return `123(m,e,r){${body}}`;
  if (shape === 'named-method') return `"module-name"(m,e,r){${body}}`;
  if (shape === 'function') return `function factory(m,e,r){${body}}`;
  return `(m,e,r)=>{${body}}`;
}
function execute(result, bridge = {}, modules = {}) {
  assert.equal(result.changed, true, result.reason);
  const exports = { calls: [] };
  const requested = [];
  const require = id => { requested.push(id); if (!(id in modules)) throw new Error('Unexpected module: ' + id); return modules[id]; };
  require.d = (target, table) => { for (const [key, getter] of Object.entries(table)) Object.defineProperty(target, key, { get: getter }); };
  const context = vm.createContext({ bridge });
  const compiled = vm.runInContext(result.expression, context);
  compiled({}, exports, require);
  return { exports, requested, compiled, context };
}
function unchanged(source, expression = 'bridge') {
  const result = transform(source, expression);
  assert.equal(result.changed, false);
  assert.equal(result.source, source);
  assert.equal(result.kind, null);
  assert.equal(typeof result.reason, 'string');
  return result;
}

// A minimal bridge implementing the runtime contract; the transformer itself
// does not execute either the original getter or this bridge.
function observingBridge(observe = value => value) {
  return { observeCall(get, selector, cid) {
    const value = Reflect.apply(get, undefined, [selector, cid]);
    return observe(value, cid);
  } };
}

for (const shape of ['arrow', 'method', 'named-method', 'function']) {
  test(`${shape}: observes only original mapping result, once and by identity`, () => {
    const original = factory(CONTENT, shape);
    const result = transform(original, 'bridge');
    assert.equal(result.kind, 'mapping');
    assert.deepEqual(result.bindings, { mapping: 'value', conversation: 'cid' });
    const mapping = Object.freeze({ node: Object.freeze({}) });
    const selector = Object.freeze({ selector: 1 });
    const order = [];
    const { exports, requested } = execute(result, observingBridge((value, cid) => { order.push(['observe', value, cid]); return value; }), { selectors: { mapping: selector } });
    assert.equal(order.length, 0, 'loading the module does not read a selector');
    const got = exports.read((s, cid) => { order.push(['get', s, cid]); return mapping; }, 'cid-one');
    assert.equal(got.mapping, mapping);
    assert.deepEqual(order, [['get', selector, 'cid-one'], ['observe', mapping, 'cid-one']]);
    assert.deepEqual(requested, ['selectors'], 'only the original require runs');
  });
}

test('original mapping getter failures propagate without observation', () => {
  const result = transform(factory(CONTENT), 'bridge');
  let observed = 0;
  const error = new Error('native failure');
  const { exports } = execute(result, observingBridge(() => { observed++; }), { selectors: { mapping: {} } });
  assert.throws(() => exports.read(() => { throw error; }, 'cid'), candidate => candidate === error);
  assert.equal(observed, 0);
});

test('keeps arguments and unrelated evaluations in their original order', () => {
  const source = factory(`var S=r(1);e.read=(get,cid)=>{e.calls.push("before");let a=e.calls.push("a"),value=get(S.mapping,cid),b=e.calls.push("b");return {mapping:value,context_truncation_continuation:0,getRenderTelemetry:0,isStreaming:0}}`);
  let exports;
  ({ exports } = execute(transform(source, 'bridge'), observingBridge((value, cid) => { exports.calls.push(['observe', cid]); return value; }), { 1: { mapping: 'selector' } }));
  const object = {};
  assert.equal(exports.read(() => { exports.calls.push('get'); return object; }, 'cid').mapping, object);
  assert.deepEqual(exports.calls, ['before', 'a', 'get', ['observe', 'cid'], 'b']);
});

test('supports an uninitialized declaration followed by one plain assignment', () => {
  const source = factory(CONTENT.replace('let value=get(S.mapping,cid);', 'let value;value=get(S.mapping,cid);'));
  assert.equal(transform(source, 'bridge').kind, 'mapping');
});

test('shadowed mapping names in other functions cannot select the wrong assignment', () => {
  const source = factory(CONTENT + 'function other(get,cid){let value=get(S.unrelated,cid);return value}');
  const result = transform(source, 'bridge');
  assert.equal(result.changed, true);
  assert.ok(result.source.includes('let value=get(S.unrelated,cid)'));
  assert.equal((result.source.match(/\.observeCall\(/g) || []).length, 1);
});

test('mapping is not inferred from a property whose value resolves to another scope', () => {
  unchanged(factory(`var S=r(1);e.read=(get,cid)=>{let value=get(S.mapping,cid);return ()=>({mapping:value,context_truncation_continuation:0,getRenderTelemetry:0,isStreaming:0})}`));
});

test('shadowed selector namespace is rejected rather than requiring another module', () => {
  unchanged(factory(CONTENT.replace('(get,cid)=>{', '(get,cid,S)=>{')));
});

test('shadowed require cannot establish an imported namespace', () => {
  unchanged(factory(CONTENT.replace('var S=r("selectors");', 'var S=()=>0;')));
});

test('all non-supported mapping assignments fail closed', () => {
  const variants = [
    CONTENT.replace('let value=get(S.mapping,cid);', 'let value=get(S.mapping,cid);value=other;'),
    CONTENT.replace('let value=get(S.mapping,cid);', 'let value;value+=get(S.mapping,cid);'),
    CONTENT.replace('let value=get(S.mapping,cid);', 'let value=get(S.mapping,cid);value++;'),
    CONTENT.replace('get(S.mapping,cid)', 'get(S.mapping,makeCid())'),
    CONTENT.replace('get(S.mapping,cid)', 'get(S.mapping,missingGlobal)'),
    CONTENT.replace('get(S.mapping,cid)', 'get(S["mapping"],cid)'),
    CONTENT.replace('get(S.mapping,cid)', 'get?.(S.mapping,cid)'),
    CONTENT.replace('get(S.mapping,cid)', 'scope.get(S.mapping,cid)'),
    CONTENT.replace('get(S.mapping,cid)', 'get(S.mapping,cid,extra)'),
    CONTENT.replace('mapping:value,', 'mapping:value, mapping:other,'),
    CONTENT.replace('mapping:value,', 'mapping:value.nested,'),
    CONTENT.replace('mapping:value,', 'mapping:get(S.mapping,cid),'),
    CONTENT.replace('var S=r("selectors");', 'var S=r("selectors");S=other;'),
  ];
  for (const body of variants) unchanged(factory(body));
});

test('a captured outer conversation ID is observed at the original inner getter call', () => {
  const source = factory(CONTENT.replace('(get,cid)=>{', 'cid=>get=>{'));
  const result = transform(source, 'bridge');
  assert.equal(result.kind, 'mapping');
  assert.ok(result.source.includes('.observeCall(get,S.mapping,cid)'));
  const mapping = {};
  const observations = [];
  const { exports } = execute(result, observingBridge((value, cid) => { observations.push([value, cid]); return value; }), { selectors: { mapping: 'selector' } });
  const inner = exports.read('outer-conversation');
  assert.equal(observations.length, 0, 'creating the selector does not read mapping');
  let reads = 0;
  const output = inner((selector, cid) => { reads++; assert.equal(selector, 'selector'); assert.equal(cid, 'outer-conversation'); return mapping; });
  assert.equal(reads, 1);
  assert.equal(output.mapping, mapping);
  assert.deepEqual(observations, [[mapping, 'outer-conversation']]);
});

test('mutable local conversation bindings use the argument value captured before getter execution', () => {
  const source = factory(CONTENT.replace('(get,cid)=>{', '(get)=>{let cid="before";e.changeCid=next=>{cid=next};'));
  const mapping = {};
  const observations = [];
  const { exports } = execute(transform(source, 'bridge'), observingBridge((value, cid) => { observations.push([value, cid]); return value; }), { selectors: { mapping: 'selector' } });
  assert.equal(exports.read((selector, cid) => { assert.equal(cid, 'before'); exports.changeCid('after'); return mapping; }).mapping, mapping);
  assert.deepEqual(observations, [[mapping, 'before']]);
});

test('getter mutation of cid or a sloppy arguments alias cannot misattribute the observed result', () => {
  const bodies = [
    CONTENT.replace('let value=get(S.mapping,cid);', 'const original=get;get=(selector,id)=>{cid="another-conversation";return original(selector,id)};let value=get(S.mapping,cid);'),
    CONTENT.replace('(get,cid)=>{', 'function(get,cid){').replace('let value=get(S.mapping,cid);', 'const original=get;get=(selector,id)=>{arguments[1]="another-conversation";return original(selector,id)};let value=get(S.mapping,cid);'),
  ];
  for (const body of bodies) {
    const observations = [];
    const mapping = {};
    let reads = 0;
    const { exports } = execute(transform(factory(body), 'bridge'), observingBridge((value, cid) => { observations.push([value, cid]); return value; }), { selectors: { mapping: 'selector' } });
    const result = exports.read((selector, cid) => { reads++; assert.equal(cid, 'original-conversation'); return mapping; }, 'original-conversation');
    assert.equal(result.mapping, mapping);
    assert.equal(reads, 1);
    assert.deepEqual(observations, [[mapping, 'original-conversation']]);
  }
});

test('selector access can change get and cid while preserving callee-before-arguments evaluation', () => {
  const source = factory(CONTENT.replace('let value=get(S.mapping,cid);', 'e.change=(nextGet,nextCid)=>{get=nextGet;cid=nextCid};let value=get(S.mapping,cid);'));
  const mapping = {};
  const order = [];
  let exports;
  const selectors = { get mapping() {
    order.push('selector');
    exports.change(() => { throw new Error('replacement getter must not run'); }, 'after-selector');
    return 'selector-value';
  } };
  ({ exports } = execute(transform(source, 'bridge'), observingBridge((value, cid) => { order.push(['observe', cid]); return value; }), { selectors }));
  const result = exports.read((selector, cid) => { order.push(['original-get', selector, cid]); return mapping; }, 'before-selector');
  assert.equal(result.mapping, mapping);
  assert.deepEqual(order, ['selector', ['original-get', 'selector-value', 'after-selector'], ['observe', 'after-selector']]);
});

test('selector getter errors propagate identically without calling get or observing', () => {
  const error = new Error('selector-access-failure');
  let gets = 0;
  let observations = 0;
  const selectors = { get mapping() { throw error; } };
  const { exports } = execute(transform(factory(CONTENT), 'bridge'), observingBridge(() => { observations++; }), { selectors });
  assert.throws(() => exports.read(() => { gets++; }, 'cid'), value => value === error);
  assert.equal(gets, 0);
  assert.equal(observations, 0);
});

test('Proxy apply traps see one unbound call, original arguments, and unchanged results or throws', () => {
  for (const throwing of [false, true]) {
    const mapping = {};
    const error = new Error('proxy-apply-failure');
    const calls = [];
    const observations = [];
    const get = new Proxy(function () {}, { apply(target, receiver, args) {
      calls.push([receiver, [...args]]);
      if (throwing) throw error;
      return mapping;
    }, get(target, key) { if (key === 'apply' || key === 'call') throw new Error('must not read a function helper'); return Reflect.get(target, key); } });
    const { exports } = execute(transform(factory(CONTENT), 'bridge'), observingBridge((value, cid) => { observations.push([value, cid]); return value; }), { selectors: { mapping: 'selector' } });
    if (throwing) assert.throws(() => exports.read(get, 'cid'), value => value === error);
    else assert.equal(exports.read(get, 'cid').mapping, mapping);
    assert.deepEqual(calls, [[undefined, ['selector', 'cid']]]);
    assert.deepEqual(observations, throwing ? [] : [[mapping, 'cid']]);
  }
});

for (const strict of [false, true]) {
  test(`observeCall preserves ${strict ? 'strict' : 'sloppy'} getter this semantics in its own realm`, () => {
    const transformed = transform(factory(CONTENT), 'bridge');
    const { exports, context } = execute(transformed, observingBridge(), { selectors: { mapping: 'selector' } });
    const get = vm.runInContext(`(function(selector,cid){${strict ? '"use strict";' : ''}return {receiver:this,selector,cid}})`, context);
    const result = exports.read(get, 'cid').mapping;
    assert.equal(result.receiver, strict ? undefined : vm.runInContext('globalThis', context));
    assert.equal(result.selector, 'selector');
    assert.equal(result.cid, 'cid');
  });
}

test('parenthesized callee and arguments retain identifier-call semantics', () => {
  const source = factory(CONTENT.replace('get(S.mapping,cid)', '((get)) ( /* selector */ (S.mapping), /* conversation */ (cid))'));
  const mapping = {};
  const { exports } = execute(transform(source, 'bridge'), observingBridge(), { selectors: { mapping: 'selector' } });
  assert.equal(exports.read((selector, cid) => { assert.equal(selector, 'selector'); assert.equal(cid, 'cid'); return mapping; }, 'cid').mapping, mapping);
});

test('string/comment/regex/template content cannot supply missing fingerprints', () => {
  const lookalikes = [
    '/* context_truncation_continuation: getRenderTelemetry: isStreaming: mapping:value */',
    'const text="context_truncation_continuation: getRenderTelemetry: isStreaming: mapping:value";',
    'const text=/context_truncation_continuation:getRenderTelemetry:isStreaming:mapping:value/;',
    'const text=`context_truncation_continuation: getRenderTelemetry: isStreaming: mapping:value`;',
  ];
  for (const body of lookalikes) unchanged(factory(body));
  unchanged(factory(CONTENT.replace('context_truncation_continuation:null,', '') + '/*context_truncation_continuation:*/'));
});

test('message module wraps both unique local components without calling them', () => {
  const registrations = [];
  const R = { useState() { throw new Error('unexpected hook'); } };
  const J = { jsx: (component, props) => ({ component, props }), jsxs: (component, props) => ({ component, props }) };
  const result = transform(factory(MESSAGE, 'method'), 'bridge');
  assert.equal(result.kind, 'message');
  const { exports, requested } = execute(result, { message(fn, react, assistant) {
    registrations.push([fn, react, assistant]);
    return function (...args) { return fn.apply(this, args); };
  } }, { react: R, jsx: J });
  assert.equal(registrations.length, 2);
  assert.equal(registrations[0][1], R);
  assert.equal(registrations[0][2], false);
  assert.equal(registrations[1][1], R);
  assert.equal(registrations[1][2], true);
  assert.equal(exports.calls.length, 0, 'neither hook nor native component executes during transform/registration');
  assert.deepEqual(requested, ['react', 'jsx']);
  const props = { item: {} };
  const receiver = {};
  const originalResult = exports.getUser().call(receiver, props);
  assert.equal(originalResult.kind, 'native-user');
  assert.equal(originalResult.props, props);
  assert.equal(exports.calls.length, 1);
  assert.equal(exports.calls[0][1], receiver);
  assert.equal(exports.calls[0][2], props);
  assert.equal(exports.renderUser(props).component, exports.getUser());
  assert.equal(exports.renderActions(props).component, exports.getActions());
});

test('repeated JSX callsites for the same binding remain one candidate', () => {
  const source = factory(MESSAGE + 'function extra(p){return J.jsx(User,{item:p,items:[],isMostRecentTurn:true,isReadOnly:false})}');
  assert.equal(transform(source, 'bridge').kind, 'message');
});

test('nested props and unrelated literal lookalikes do not confuse JSX matching', () => {
  const source = factory(MESSAGE.replace('item:props.item,', 'item:{nested:props.item},') + 'let decoy="J.jsx(Evil,{item:1,items:2,isMostRecentTurn:3,isReadOnly:4})";');
  assert.equal(transform(source, 'bridge').kind, 'message');
});

test('shadowed component and React identifiers cannot redirect wrapping', () => {
  const variants = [
    MESSAGE.replace('e.renderUser=props=>', 'e.renderUser=(props,User)=>'),
    MESSAGE.replace('var R=r("react"),J=r("jsx");', 'var R=r("react");var J={jsx(){},jsxs(){}};'),
    MESSAGE.replace('function User(props)', 'const User=function(props)'),
  ];
  for (const body of variants) unchanged(factory(body));
});

test('ambiguous message candidate, namespace, and marker sets are unchanged', () => {
  unchanged(factory(MESSAGE + 'function Other(){};J.jsx(Other,{item:1,items:[],isMostRecentTurn:true,isReadOnly:false});'));
  unchanged(factory(MESSAGE + 'var R2=r("react2");function Other(){R2.useState(0)}'));
  unchanged(factory(MESSAGE.replace('e.getCopyHtml=0;', '/*getCopyHtml*/')));
  unchanged(factory(MESSAGE.replace('e.copyPlainTextFromSource=0;', '"copyPlainTextFromSource";')));
  unchanged(factory(MESSAGE.replace('Actions,{assistantItem:', 'User,{assistantItem:')));
});

test('wraps an exported boundary with its own React namespace and live export getter', () => {
  let registered;
  let hookCalls = 0;
  const R = { useMemo(callback) { hookCalls++; return callback(); } };
  const result = transform(factory(BOUNDARY), 'bridge');
  assert.equal(result.kind, 'boundary');
  assert.deepEqual(result.bindings, { boundary: 'Turns', react: 'R' });
  const { exports, requested } = execute(result, { boundary(fn, react) {
    assert.equal(react, R);
    registered = fn;
    return function (...args) { return fn.apply(this, args); };
  } }, { react: R });
  assert.equal(typeof registered, 'function');
  assert.notEqual(exports.render, registered);
  assert.equal(exports.calls.length, 0);
  assert.deepEqual(requested, ['react']);
  assert.equal(hookCalls, 0);
  const receiver = {};
  const props = { time: 42 };
  const resultValue = exports.render.call(receiver, props);
  assert.equal(resultValue.timestampSeparatorAtMs, 42);
  assert.equal(hookCalls, 1);
  assert.equal(exports.calls.length, 1);
  assert.equal(exports.calls[0][0], receiver);
  assert.equal(exports.calls[0][1], props);
});

test('boundary getter may have an explicit return and multiple export aliases', () => {
  const body = BOUNDARY.replace('{render:()=>Turns}', '{render:()=>{return Turns},alias:()=>Turns}');
  assert.equal(transform(factory(body), 'bridge').kind, 'boundary');
});

test('boundary registration before the message module receives React immediately', () => {
  const R = { useMemo: callback => callback(), useState() { throw new Error('unexpected hook'); } };
  const J = { jsx() {}, jsxs() {} };
  const order = [];
  const bridge = {
    boundary(fn, react) { assert.equal(react, R); order.push('boundary-ready'); return fn; },
    message(fn, react) { assert.equal(react, R); order.push('message-ready'); return fn; },
  };
  const boundary = execute(transform(factory(BOUNDARY), 'bridge'), bridge, { react: R });
  assert.deepEqual(order, ['boundary-ready']);
  assert.equal(boundary.exports.render({ time: 7 }).timestampSeparatorAtMs, 7);
  execute(transform(factory(MESSAGE), 'bridge'), bridge, { react: R, jsx: J });
  assert.deepEqual(order, ['boundary-ready', 'message-ready', 'message-ready']);
});

test('boundary without its own hook namespace delegates loaded-React fallback to the bridge', () => {
  const source = factory(BOUNDARY.replace('var R=r("react");', '').replace('(0,R.useMemo)(()=>props.time,[])', 'props.time'));
  const result = transform(source, 'bridge');
  assert.equal(result.kind, 'boundary');
  assert.deepEqual(result.bindings, { boundary: 'Turns', react: null });
  let received;
  const { exports, requested } = execute(result, { boundary(...args) { received = args; return args[0]; } });
  assert.equal(received.length, 1, 'no hook namespace or extra import is fabricated');
  assert.equal(exports.calls.length, 0);
  assert.deepEqual(requested, []);
  assert.equal(exports.render({ time: 43 }).timestampSeparatorAtMs, 43);
  assert.equal(exports.calls.length, 1);
});

test('boundary still rejects ambiguous identifiable React namespaces', () => {
  assert.equal(unchanged(factory(BOUNDARY + 'var R2=r("other-react");function Other(){return R2.useRef(null)}')).reason, 'ambiguous-react-namespace');
});

test('message modules without hook imports preserve both exact component anchors and assistant flags', () => {
  const source = factory(MESSAGE.replace('var R=r("react"),J=r("jsx");', 'var J=r("jsx");').replace('function State(){return (0,R.useState)(0)}', ''));
  const result = transform(source, 'bridge');
  assert.equal(result.kind, 'message');
  assert.deepEqual(result.bindings, { user: 'User', assistant: 'Actions', react: null });
  const registrations = [];
  const { exports, requested } = execute(result, { message(fn, react, assistant) { registrations.push([fn, react, assistant]); return fn; } }, { jsx: { jsx() {}, jsxs() {} } });
  assert.equal(registrations.length, 2);
  assert.equal(registrations[0][1], undefined);
  assert.equal(registrations[0][2], false);
  assert.equal(registrations[1][1], undefined);
  assert.equal(registrations[1][2], true);
  assert.equal(exports.calls.length, 0);
  assert.deepEqual(requested, ['jsx']);
  assert.equal(exports.getUser()({}).kind, 'native-user');
  assert.equal(exports.calls.length, 1);
  unchanged(factory(source.slice(source.indexOf('{') + 1, -1).replace('isReadOnly:false', 'unrelated:false')));
});

test('shadowed hook namespace is never passed as React when fallback is used', () => {
  const result = transform(factory(MESSAGE.replace('function State(){', 'function State(R){')), 'bridge');
  assert.equal(result.kind, 'message');
  assert.equal(result.bindings.react, null);
  assert.ok(result.source.includes('.message(User,void 0,false)'));
  assert.ok(result.source.includes('.message(Actions,void 0,true)'));
});

test('boundary exports, markers, local declarations, and require identity are checked', () => {
  const variants = [
    BOUNDARY.replace('r.d(e,', 'other.d(e,'),
    BOUNDARY.replace('r.d(e,', 'r.d(other,'),
    BOUNDARY.replace('render:()=>Turns', 'render:()=>other.Turns'),
    BOUNDARY.replace('timestampSeparatorAtMs:(0,R.useMemo)(()=>props.time,[])', 'other:"timestampSeparatorAtMs"'),
    BOUNDARY.replace('id:"pending-chatgpt-submit"', 'id:"other"') + '/*id:"pending-chatgpt-submit"*/',
    BOUNDARY.replace('function Turns(props)', 'const Turns=function(props)'),
    BOUNDARY.replace('render:()=>Turns', 'render:()=>Turns,other:()=>Other') + 'function Other(){return {timestampSeparatorAtMs:0}}',
  ];
  for (const body of variants) unchanged(factory(body));
});

test('ambiguous module kinds are never combined', () => {
  unchanged(factory(CONTENT + MESSAGE));
  unchanged(factory(CONTENT + BOUNDARY));
});

test('factory-level early returns prevent append-only wrappers', () => {
  unchanged(factory(MESSAGE + 'if(e.stop)return;'));
  unchanged(factory(BOUNDARY + 'return e;'));
});

test('dynamic scope, class scope, invalid syntax, unsupported factory forms fail closed', () => {
  const variants = [
    factory(CONTENT + 'eval("anything")'),
    factory(CONTENT + 'with(e){}'),
    factory(CONTENT + 'class X{}'),
    factory(CONTENT + 'r=()=>0;'),
    factory(CONTENT + 'e=other;'),
    '(m,e,r)=> (' + JSON.stringify(CONTENT) + ')',
    'async (m,e,r)=>{' + CONTENT + '}',
    'function*(m,e,r){' + CONTENT + '}',
    '[computed](m,e,r){' + CONTENT + '}',
    '(m,e,r,extra)=>{' + CONTENT + '}',
    '(m,e,r)=>{' + CONTENT,
  ];
  for (const source of variants) unchanged(source);
});

test('bridge expression allows only an unshadowed static global path', () => {
  const source = factory(CONTENT);
  assert.equal(transform(source, 'globalThis["metadata-bridge"]').changed, true);
  for (const expression of ['bridge()', 'bridge[choose()]', 'bridge?.x', 'bridge,x', '(function(){})()', '', null]) unchanged(source, expression);
  unchanged(factory(CONTENT.replace('(get,cid)=>{', '(get,cid,bridge)=>{')));
  unchanged(factory('var globalThis={};' + CONTENT), 'globalThis.bridge');
});

test('second transform is a no-op and does not grow wrappers', () => {
  for (const body of [CONTENT, MESSAGE, BOUNDARY]) {
    const result = transform(factory(body), 'bridge');
    assert.equal(result.changed, true, result.reason);
    unchanged(result.source);
  }
});

test('unrelated valid and malformed sources remain byte-for-byte unchanged', () => {
  for (const source of ['(m,e,r)=>{e.value=1}', '42(m,e,r){r(1)}', 'garbage', '', 'function module(m,e,r){return e}']) unchanged(source);
});

test('transforming source never evaluates or calls a factory', () => {
  globalThis.__metadata_transform_executed = false;
  const source = factory('globalThis.__metadata_transform_executed=true;' + CONTENT);
  assert.equal(transform(source, 'bridge').changed, true);
  assert.equal(globalThis.__metadata_transform_executed, false);
  delete globalThis.__metadata_transform_executed;
});

test('standalone browser expression has no require/global-parser dependency', () => {
  const filename = path.join(__dirname, '../../src/metadata/module-metadata-transform.browser.js');
  const source = fs.readFileSync(filename, 'utf8');
  const context = vm.createContext({});
  const browserTransform = vm.runInContext(source, context);
  assert.equal(typeof browserTransform, 'function');
  assert.equal('acorn' in context, false);
  assert.equal('module' in context, false);
  assert.equal('exports' in context, false);
  for (const body of [CONTENT, MESSAGE, BOUNDARY]) {
    const original = factory(body, 'method');
    const native = transform(original, 'bridge');
    const browser = browserTransform(original, 'bridge');
    assert.equal(browser.source, native.source);
    assert.equal(browser.expression, native.expression);
    assert.equal(browser.kind, native.kind);
  }
});


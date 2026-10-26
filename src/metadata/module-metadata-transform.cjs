'use strict';

/*
 * Independent, metadata-only webpack factory source transformer. MIT.
 * The input factory is parsed but is never evaluated or called by this module.
 * All changes are source-range edits; unrecognized or ambiguous input is
 * returned byte-for-byte. The caller owns compilation and a non-throwing bridge.
 */
function createMetadataTransformer(acorn) {
  const MAX_SOURCE_LENGTH = 1500000;
  const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
  const REACT_HOOKS = new Set(['useState', 'useEffect', 'useLayoutEffect', 'useRef', 'useMemo', 'useCallback', 'useContext', 'useReducer', 'useSyncExternalStore']);
  const CONTENT_KEYS = ['context_truncation_continuation', 'getRenderTelemetry', 'isStreaming'];
  const MESSAGE_MARKERS = ['copyPlainTextFromSource', 'suppressCopyTurnToClipboardAnalytics', 'getCopyHtml'];
  const USER_KEYS = ['item', 'items', 'isMostRecentTurn', 'isReadOnly'];
  const ASSISTANT_KEYS = ['assistantItem', 'additionalTurnActions', 'actionRowRef'];
  const OPTIONS = { ecmaVersion: 'latest', sourceType: 'script' };

  function children(node) {
    const result = [];
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (value && typeof value.type === 'string') result.push(value);
      else if (Array.isArray(value)) for (const item of value) if (item && typeof item.type === 'string') result.push(item);
    }
    return result;
  }

  function parseFactory(source) {
    for (const [prefix, suffix, method] of [['(', ')', false], ['({', '})', true]]) {
      try {
        const ast = acorn.parse(prefix + source + suffix, OPTIONS);
        if (ast.body.length !== 1 || ast.body[0].type !== 'ExpressionStatement') continue;
        let factory = ast.body[0].expression;
        let methodKey = null;
        if (method) {
          if (factory.type !== 'ObjectExpression' || factory.properties.length !== 1) continue;
          const property = factory.properties[0];
          if (property.type !== 'Property' || !property.method || property.computed || property.kind !== 'init') continue;
          methodKey = property.key.type === 'Identifier' ? property.key.name : property.key.value;
          if (!['string', 'number'].includes(typeof methodKey)) continue;
          factory = property.value;
        }
        if (!FUNCTION_TYPES.has(factory.type) || factory.async || factory.generator || factory.body.type !== 'BlockStatement') continue;
        if (factory.params.length !== 3 || factory.params.some(param => param.type !== 'Identifier')) continue;
        return { factory, offset: prefix.length, methodKey };
      } catch (_) {
        // Function#toString() can return either an expression or a method body.
      }
    }
    return null;
  }

  function staticKey(node) {
    if (!node) return null;
    if ((node.type === 'Property' || node.type === 'MethodDefinition' || node.type === 'PropertyDefinition') && !node.computed) {
      return node.key.type === 'Identifier' ? node.key.name : typeof node.key.value === 'string' ? node.key.value : null;
    }
    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') return node.property.name;
    if (node.type === 'MemberExpression' && node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') return node.property.value;
    return null;
  }

  function plainCallee(node) {
    if (node && node.type === 'SequenceExpression' && node.expressions.length === 2 && node.expressions[0].type === 'Literal' && node.expressions[0].value === 0) return node.expressions[1];
    return node;
  }

  function analyze(factory) {
    const scopes = new WeakMap();
    const parents = new WeakMap();
    const nodes = [];
    const allBindings = [];
    let unsafe = false;
    function makeScope(parent, kind, owner) { return { parent, kind, owner, bindings: new Map() }; }
    const root = makeScope(null, 'function', factory);
    let bodyScope;
    function bind(scope, identifier, kind, declaration, initializer) {
      if (!identifier || identifier.type !== 'Identifier') return;
      let binding = scope.bindings.get(identifier.name);
      if (!binding) {
        binding = { name: identifier.name, scope, kind, declaration, initializer, declarations: [], writes: [] };
        scope.bindings.set(identifier.name, binding);
        allBindings.push(binding);
      }
      binding.declarations.push({ identifier, kind, declaration, initializer });
      scopes.set(identifier, scope);
    }
    function pattern(scope, node, kind, declaration, initializer) {
      if (!node) return;
      if (node.type === 'Identifier') bind(scope, node, kind, declaration, initializer);
      else if (node.type === 'RestElement') pattern(scope, node.argument, kind, declaration, null);
      else if (node.type === 'AssignmentPattern') pattern(scope, node.left, kind, declaration, null);
      else if (node.type === 'ArrayPattern') for (const element of node.elements) pattern(scope, element, kind, declaration, null);
      else if (node.type === 'ObjectPattern') for (const property of node.properties) pattern(scope, property.type === 'RestElement' ? property.argument : property.value, kind, declaration, null);
    }
    function visit(node, scope, parent) {
      nodes.push(node);
      parents.set(node, parent);
      scopes.set(node, scope);
      if (node.type === 'WithStatement' || node.type === 'ClassDeclaration' || node.type === 'ClassExpression') unsafe = true;
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'eval') unsafe = true;
      if (FUNCTION_TYPES.has(node.type)) {
        if (node !== factory && node.type === 'FunctionDeclaration' && node.id) bind(scope, node.id, 'function', node, node);
        const inner = node === factory ? root : makeScope(scope, 'function', node);
        scopes.set(node, inner);
        if (node !== factory && node.type === 'FunctionExpression' && node.id) bind(inner, node.id, 'self', node, node);
        for (const param of node.params) pattern(inner, param, 'param', node, null);
        for (const param of node.params) visit(param, inner, node);
        visit(node.body, inner, node);
        return;
      }
      if (node.type === 'BlockStatement' || node.type === 'CatchClause' || node.type === 'SwitchStatement' || node.type === 'ForStatement' || node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
        const inner = makeScope(scope, 'block', scope.owner);
        scopes.set(node, inner);
        if (node === factory.body) bodyScope = inner;
        if (node.type === 'CatchClause') pattern(inner, node.param, 'catch', node, null);
        for (const child of children(node)) visit(child, inner, node);
        return;
      }
      if (node.type === 'VariableDeclaration') {
        let target = scope;
        if (node.kind === 'var') while (target.parent && target.kind !== 'function') target = target.parent;
        for (const declaration of node.declarations) pattern(target, declaration.id, node.kind, declaration, declaration.init);
      }
      if (node.type === 'ClassDeclaration' && node.id) bind(scope, node.id, 'class', node, node);
      for (const child of children(node)) visit(child, scope, node);
    }
    visit(factory, root, null);
    function resolve(node) {
      if (!node || node.type !== 'Identifier') return null;
      return resolveName(scopes.get(node), node.name);
    }
    function resolveName(scope, name) {
      for (let current = scope; current; current = current.parent) if (current.bindings.has(name)) return current.bindings.get(name);
      return null;
    }
    function writePattern(node, write) {
      if (!node) return;
      if (node.type === 'Identifier') { const binding = resolve(node); if (binding) binding.writes.push(write); }
      else if (node.type === 'ArrayPattern') for (const item of node.elements) writePattern(item, write);
      else if (node.type === 'ObjectPattern') for (const property of node.properties) writePattern(property.type === 'RestElement' ? property.argument : property.value, write);
      else if (node.type === 'AssignmentPattern') writePattern(node.left, write);
      else if (node.type === 'RestElement') writePattern(node.argument, write);
    }
    for (const binding of allBindings) for (const declaration of binding.declarations) if (declaration.initializer) binding.writes.push({ node: declaration.declaration, value: declaration.initializer, kind: 'initial' });
    for (const node of nodes) {
      if (node.type === 'AssignmentExpression') writePattern(node.left, { node, value: node.right, kind: node.operator === '=' ? 'assign' : 'other' });
      if (node.type === 'UpdateExpression') writePattern(node.argument, { node, value: null, kind: 'other' });
      if (node.type === 'ForInStatement' || node.type === 'ForOfStatement') if (node.left.type !== 'VariableDeclaration') writePattern(node.left, { node, value: null, kind: 'other' });
    }
    const requireBinding = resolve(factory.params[2]);
    const exportsBinding = resolve(factory.params[1]);
    function atFactory(binding) { return binding && (binding.scope === root || binding.scope === bodyScope); }
    function directDeclaration(binding) {
      const declaration = binding.declaration;
      const statement = declaration.type === 'VariableDeclarator' ? parents.get(declaration) : declaration;
      return statement && parents.get(statement) === factory.body;
    }
    function imported(binding) {
      if (!atFactory(binding) || !directDeclaration(binding) || binding.declarations.length !== 1 || binding.writes.length !== 1) return false;
      const call = binding.initializer;
      return call && call.type === 'CallExpression' && !call.optional && call.callee.type === 'Identifier' && resolve(call.callee) === requireBinding && call.arguments.length === 1 && call.arguments[0].type === 'Literal' && ['string', 'number'].includes(typeof call.arguments[0].value);
    }
    function nativeFunction(binding) {
      return atFactory(binding) && directDeclaration(binding) && binding.declarations.length === 1 && binding.writes.length === 1 && ['function', 'var', 'let'].includes(binding.kind) && binding.initializer && FUNCTION_TYPES.has(binding.initializer.type) && !binding.initializer.async && !binding.initializer.generator;
    }
    return { nodes, scopes, parents, root, bodyScope, resolve, resolveName, requireBinding, exportsBinding, atFactory, imported, nativeFunction, unsafe };
  }

  function objectProperties(node, keys) {
    if (!node || node.type !== 'ObjectExpression') return false;
    const properties = node.properties.filter(property => property.type === 'Property' && property.kind === 'init' && !property.computed);
    return keys.every(key => properties.filter(property => staticKey(property) === key).length === 1);
  }

  function validateBridge(expression, info, insertionScopes) {
    if (typeof expression !== 'string' || !expression || expression.length > 300) return null;
    try {
      const ast = acorn.parse('(' + expression + ')', OPTIONS);
      if (ast.body.length !== 1 || ast.body[0].type !== 'ExpressionStatement') return null;
      let node = ast.body[0].expression;
      while (node.type === 'MemberExpression' && !node.optional) {
        if (node.computed && !(node.property.type === 'Literal' && ['string', 'number'].includes(typeof node.property.value))) return null;
        if (!node.computed && node.property.type !== 'Identifier') return null;
        node = node.object;
      }
      if (node.type !== 'Identifier') return null;
      // A module-local alias named like the bridge cannot redirect our calls.
      if (insertionScopes.some(scope => info.resolveName(scope, node.name))) return null;
      return '(' + expression + ')';
    } catch (_) { return null; }
  }

  function uniqueReact(info, hookNames) {
    const bindings = new Set();
    for (const node of info.nodes) {
      if (node.type !== 'CallExpression' || node.optional) continue;
      const callee = plainCallee(node.callee);
      if (!callee || callee.type !== 'MemberExpression' || callee.optional || !hookNames.has(staticKey(callee)) || callee.object.type !== 'Identifier') continue;
      const binding = info.resolve(callee.object);
      if (info.imported(binding)) bindings.add(binding);
    }
    return [...bindings];
  }

  function mappingPlan(info) {
    const properties = info.nodes.filter(node => node.type === 'Property' && node.kind === 'init' && !node.computed && staticKey(node) === 'mapping' && info.parents.get(node).type === 'ObjectExpression');
    if (properties.length !== 1 || properties[0].value.type !== 'Identifier') return { reason: 'ambiguous-mapping' };
    const property = properties[0];
    const binding = info.resolve(property.value);
    if (!binding || binding.declarations.length !== 1 || binding.writes.length !== 1) return { reason: 'unsupported-mapping-binding' };
    const write = binding.writes[0];
    if (!['initial', 'assign'].includes(write.kind)) return { reason: 'unsupported-mapping-assignment' };
    const call = write.value;
    if (!call || call.type !== 'CallExpression' || call.optional || call.callee.type !== 'Identifier' || call.arguments.length !== 2 || !info.resolve(call.callee)) return { reason: 'unsupported-mapping-call' };
    const [selector, conversation] = call.arguments;
    if (selector.type !== 'MemberExpression' || selector.computed || selector.optional || selector.object.type !== 'Identifier' || selector.property.type !== 'Identifier' || !info.imported(info.resolve(selector.object))) return { reason: 'unsupported-mapping-selector' };
    if (conversation.type !== 'Identifier' || !info.resolve(conversation)) return { reason: 'unsupported-conversation-argument' };
    // observeCall receives the callee and both arguments in their original
    // left-to-right evaluation order. It uses that captured conversation value,
    // so outer closures, assignments, and arguments aliases need no extra read.
    if (info.scopes.get(property).owner !== info.scopes.get(call).owner) return { reason: 'mapping-crosses-function-boundary' };
    return { kind: 'mapping', call, conversation, scopes: [info.scopes.get(call)], bindings: { mapping: binding.name, conversation: conversation.name } };
  }

  function messagePlan(info) {
    const users = new Set();
    const assistants = new Set();
    for (const node of info.nodes) {
      if (node.type !== 'CallExpression' || node.optional || node.arguments.length < 2) continue;
      const callee = plainCallee(node.callee);
      if (!callee || callee.type !== 'MemberExpression' || callee.optional || !['jsx', 'jsxs'].includes(staticKey(callee)) || callee.object.type !== 'Identifier' || !info.imported(info.resolve(callee.object))) continue;
      const component = node.arguments[0];
      if (component.type !== 'Identifier') continue;
      if (objectProperties(node.arguments[1], USER_KEYS)) users.add(info.resolve(component));
      if (objectProperties(node.arguments[1], ASSISTANT_KEYS)) assistants.add(info.resolve(component));
    }
    if (users.size !== 1 || assistants.size !== 1) return { reason: 'ambiguous-message-components' };
    const [user] = users;
    const [assistant] = assistants;
    if (user === assistant || !info.nativeFunction(user) || !info.nativeFunction(assistant)) return { reason: 'unsupported-message-components' };
    const react = uniqueReact(info, new Set(['useState']));
    if (react.length > 1) return { reason: 'ambiguous-react-namespace' };
    return { kind: 'message', user, assistant, react: react[0] || null, scopes: [info.bodyScope], bindings: { user: user.name, assistant: assistant.name, react: react[0] ? react[0].name : null } };
  }

  function boundaryPlan(info) {
    const exports = new Set();
    for (const node of info.nodes) {
      if (node.type !== 'CallExpression' || node.optional || node.arguments.length < 2) continue;
      const callee = node.callee;
      if (callee.type !== 'MemberExpression' || callee.optional || staticKey(callee) !== 'd' || callee.object.type !== 'Identifier' || info.resolve(callee.object) !== info.requireBinding || info.resolve(node.arguments[0]) !== info.exportsBinding) continue;
      const table = node.arguments[1];
      if (table.type !== 'ObjectExpression') continue;
      for (const property of table.properties) {
        if (property.type !== 'Property' || property.computed || property.kind !== 'init') continue;
        const getter = property.value;
        if (!FUNCTION_TYPES.has(getter.type) || getter.async || getter.generator || getter.params.length) continue;
        let value = getter.body;
        if (value.type === 'BlockStatement' && value.body.length === 1 && value.body[0].type === 'ReturnStatement') value = value.body[0].argument;
        const binding = info.resolve(value);
        if (info.nativeFunction(binding)) exports.add(binding);
      }
    }
    const candidates = [...exports].filter(binding => info.nodes.some(node => node.start >= binding.initializer.start && node.end <= binding.initializer.end && ((node.type === 'Identifier' && node.name === 'timestampSeparatorAtMs') || staticKey(node) === 'timestampSeparatorAtMs')));
    if (candidates.length !== 1) return { reason: 'ambiguous-boundary-export' };
    const boundary = candidates[0];
    const react = uniqueReact(info, REACT_HOOKS);
    if (react.length > 1) return { reason: 'ambiguous-react-namespace' };
    return { kind: 'boundary', boundary, react: react[0] || null, scopes: [info.bodyScope], bindings: { boundary: boundary.name, react: react[0] ? react[0].name : null } };
  }

  function applyEdits(source, edits) {
    let result = source;
    for (const edit of edits.sort((a, b) => b.position - a.position)) result = result.slice(0, edit.position) + edit.text + result.slice(edit.end === undefined ? edit.position : edit.end);
    return result;
  }

  function transformFactory(source, bridgeExpression) {
    const unchanged = reason => ({ source, changed: false, kind: null, reason });
    if (typeof source !== 'string' || source.length > MAX_SOURCE_LENGTH) return unchanged('unsupported-source');
    if (!CONTENT_KEYS.every(key => source.includes(key)) && !MESSAGE_MARKERS.every(key => source.includes(key)) && !(source.includes('pending-chatgpt-submit') && source.includes('timestampSeparatorAtMs'))) return unchanged('unmatched');
    try {
      const parsed = parseFactory(source);
      if (!parsed) return unchanged('unsupported-factory');
      const { factory, offset } = parsed;
      const info = analyze(factory);
      if (info.unsafe || info.requireBinding.writes.length || info.exportsBinding.writes.length) return unchanged('unsupported-dynamic-scope');
      // Structural markers only: comments and arbitrary string contents cannot
      // qualify a module. The message markers may be identifier/member names.
      const propertyKeys = new Set(info.nodes.filter(node => node.type === 'Property' && info.parents.get(node).type === 'ObjectExpression').map(staticKey));
      const names = new Set(info.nodes.flatMap(node => node.type === 'Identifier' ? [node.name] : staticKey(node) ? [staticKey(node)] : []));
      const content = CONTENT_KEYS.every(key => propertyKeys.has(key));
      const message = MESSAGE_MARKERS.every(key => names.has(key));
      const boundary = info.nodes.some(node => node.type === 'Property' && staticKey(node) === 'id' && node.value.type === 'Literal' && node.value.value === 'pending-chatgpt-submit' && info.parents.get(node).type === 'ObjectExpression') && names.has('timestampSeparatorAtMs');
      const matches = [content && 'mapping', message && 'message', boundary && 'boundary'].filter(Boolean);
      if (matches.length !== 1) return unchanged(matches.length ? 'ambiguous-module-kind' : 'unmatched');
      const plan = content ? mappingPlan(info) : message ? messagePlan(info) : boundaryPlan(info);
      if (!plan.kind) return unchanged(plan.reason);
      if (plan.kind !== 'mapping' && info.nodes.some(node => node.type === 'ReturnStatement' && info.scopes.get(node).owner === factory)) return unchanged('unsupported-factory-return');
      const bridge = validateBridge(bridgeExpression, info, plan.scopes);
      if (!bridge) return unchanged('unsafe-bridge-expression');
      let insertions;
      if (plan.kind === 'mapping') {
        const originalArguments = [plan.call.callee, ...plan.call.arguments].map(node => source.slice(node.start - offset, node.end - offset));
        insertions = [{
          position: plan.call.start - offset,
          end: plan.call.end - offset,
          text: bridge + '.observeCall(' + originalArguments.join(',') + ')',
        }];
      } else {
        const addition = plan.kind === 'message'
          ? ';' + plan.user.name + '=' + bridge + '.message(' + plan.user.name + ',' + (plan.react ? plan.react.name : 'void 0') + ',false);' + plan.assistant.name + '=' + bridge + '.message(' + plan.assistant.name + ',' + (plan.react ? plan.react.name : 'void 0') + ',true);'
          : ';' + plan.boundary.name + '=' + bridge + '.boundary(' + plan.boundary.name + (plan.react ? ',' + plan.react.name : '') + ');';
        insertions = [{ position: factory.body.end - offset - 1, text: '\n' + addition + '\n' }];
      }
      const result = applyEdits(source, insertions);
      const expression = parsed.methodKey === null ? '(' + result + ')' : '({' + result + '})[' + JSON.stringify(parsed.methodKey) + ']';
      return { source: result, expression, changed: true, kind: plan.kind, reason: null, bindings: plan.bindings };
    } catch (_) {
      // A parser limit or unexpected newer syntax must not break the host app.
      return unchanged('unsupported-syntax');
    }
  }
  return transformFactory;
}

const transformFactory = createMetadataTransformer(require('../../vendor/acorn/acorn.js'));
module.exports = transformFactory;
module.exports.transformFactory = transformFactory;
module.exports.createMetadataTransformer = createMetadataTransformer;


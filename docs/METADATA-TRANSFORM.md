# Metadata factory transformer

`module-metadata-transform.cjs` is an independently implemented, MIT-licensed
source transformer. It parses a factory without evaluating it or calling any
application function. It does not fetch, require, subscribe to, or inspect an
application module at transformation time.

## Integration

- In Node, `require('./module-metadata-transform.cjs')` returns the transformer.
- `module-metadata-transform.browser.js` is a standalone expression returning the
  same function. Its entire contents can follow `const transformMessageFactory =`.
  It contains pinned Acorn and its MIT notice, and requires no external globals,
  package imports, network requests, `eval`, or `Function` constructor.
- Call `transformMessageFactory(factorySource, bridgeExpression)`.
- On success the result is `{source, expression, changed: true, kind, reason: null,
  bindings}`. `source` preserves the original source outside narrow insertions.
  `expression` is a compilable expression even when `Function#toString` supplied
  an object method such as `123(module, exports, require){...}`.
- On any unsupported/ambiguous input it returns the original `source` exactly,
  `changed: false`, `kind: null`, and a fixed diagnostic `reason`. No diagnostic
  contains application source or user values.
- The bridge expression must be a statically named, unshadowed global path, such
  as `globalThis["your-private-bridge-key"]`. Runtime bridge methods must be
  non-throwing and obey the contracts below. Compilation and bridge installation
  are deliberately outside this module.

## Narrow supported changes

1. **Mapping:** A factory with actual object-property markers
   `context_truncation_continuation`, `getRenderTelemetry`, and `isStreaming`, and
   exactly one `mapping: value` property can change its unique local assignment
   from `value = get(imported.selector, conversation)` to
   `value = bridge.observe(get(imported.selector, conversation), conversation)`.
   The imported namespace is tied to an existing factory-local literal require
   declaration. The original getter call stays in place and runs once. The
   conversation identifier must be an unmodified parameter of the same selector
   function, with no `arguments` aliasing. `observe` must return its first input
   unchanged and must not request or retain message body data.
2. **Message:** The three real message-operation markers
   `copyPlainTextFromSource`, `suppressCopyTurnToClipboardAnalytics`, and
   `getCopyHtml`, plus two unique JSX component bindings, authorize two end-of-factory reassignments through
   `bridge.message(component, React, isAssistant)`. Required user props are
   `item`, `items`, `isMostRecentTurn`, and `isReadOnly`; assistant props are
   `assistantItem`, `additionalTurnActions`, and `actionRowRef`. The transformer
   does not call the components or React hooks. An imported `useState` namespace
   is passed when uniquely identifiable. Otherwise the React argument is `void 0`
   and the bridge may use its already-loaded React fallback. Multiple identifiable
   namespaces remain ambiguous and fail closed.
3. **Boundary:** Actual `id: "pending-chatgpt-submit"` and
   `timestampSeparatorAtMs` markers, plus one mutable local function exported
   by the factory's own webpack `require.d(exports, getters)` call, authorize
   `component = bridge.boundary(component, React)` at the factory end. A unique
   imported React namespace is passed when identifiable through existing hook
   calls. If no namespace is identifiable, the generated call is
   `bridge.boundary(component)` and the bridge may use its already-loaded React
   fallback. Multiple identifiable namespaces remain ambiguous and fail closed.
   The bridge owns commit effects and must never load React solely for metadata.

Lexical binding checks distinguish shadowed identifiers. Duplicate candidates,
constant component bindings, reassignment, top-level early returns for append
plans, dynamic scope (`eval`/`with`), classes, unsupported syntax, and mixed
module roles fail closed. This intentionally supports only known factory
shapes; it is not a general webpack decompiler. Hooks discovered from source are
never invoked by the transformer.

## Reproduction and tests

Run from the repository root:

    node tools/vendor-acorn.cjs --check
    node tools/build-metadata-transform.cjs
    node tools/build-metadata-transform.cjs --check
    node --test module-metadata-transform.test.cjs

The browser build is deterministic and contains the unchanged Acorn 8.17.0
parser, pinned to the SHA-256 documented in `vendor/acorn/README.md`.
The vendoring helper extracts the official Node.js v24.19.0-bundled Acorn source
and rejects other parser bytes. The browser build itself only needs the
checked-in parser and Node.js.

Synthetic tests validate all factory source forms, one original mapping read,
identity and exception preservation, conversation-ID mutation rejection,
lexical shadows, duplicate rejection, inert wrapper registration, live export
getters, exact source preservation, and browser-bundle parity. They do not prove
that an authenticated live ChatGPT frontend still has these factory shapes.

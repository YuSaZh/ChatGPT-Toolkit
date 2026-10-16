# Real React concurrent-render regression

Run independently from the dependency-free userscript tests:

```sh
cd validation/react-runtime
npm ci --ignore-scripts
npm test
```

This validation uses pinned official npm packages only. They are development-time dependencies; no package or bundle is loaded by the userscript. Do not distribute `node_modules`.

The fixture uses React 19.2.0's actual production reconciler, ordinary components, `React.memo`, and `startTransition`. It never creates or changes Fiber objects. The message props and cache payload are synthetic representations of the observed ChatGPT shapes. jsdom supplies DOM behavior, not React internals.

After several completed commits, a transition renders a sibling that suspends indefinitely. The prior conversation DOM remains connected and unchanged. During that pending render, the exact strict-return algorithm retained from Toolkit 1.1.15 returns zero ancestors. The committed-root forward index still finds both messages and renders both labels. Cancelling the transition restores the ordinary return path. The scenario runs with both a query-style `useState` cache and a genuine `useSyncExternalStore` mapping snapshot; every Toolkit inspection must leave the application snapshot-call counter unchanged. All fetch, XHR and WebSocket calls are blocked and counted; the count must remain zero.

This reproduces a genuine discovery bug. It does not prove that the user's authenticated ChatGPT page encountered this precise state. It does not validate Tampermonkey injection, Firefox realms, ChatGPT's live cache shape, browser layout or microphone behavior. Generic completed memo bailouts do not necessarily fail; the reproduced condition is a pending concurrent render with a shared subtree.

Primary-source explanation: [React's current-Fiber resolver](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberTreeReflection.js) explicitly handles shared child lists across alternate parents. A return chain alone is not a canonical committed-parent index.

## Passive module injection path (1.1.17)

`node run-module.cjs` executes the bundled page-world runtime through real local inline scripts in jsdom, then naturally executes source-compatible webpack factories. It uses genuine React components, not synthetic Fibers. Checks cover page acknowledgement, boundary-before-message load order, mapping identity, committed conversation leases, source-action labels, cached history round trips, display toggle isolation, formatting faults, account pause and zero network. `npm test` runs both runtime suites. This does not claim to validate a logged-in ChatGPT build, browser layout, CSP enforcement or Tampermonkey.

## Serialized page-world regression (1.1.18)

`serialized-page-runtime.test.cjs` executes the actual serialized runtime in a separate jsdom page realm. It checks strict component receivers, strict factory compilation, one original mapping invocation and argument evaluation order, transparent errors, wrapped fetch identity confirmed only by a natural call, sticky account pause, and an unreachable fetch wrapper that must leave labels hidden without probing the network. The full module fixture uses an outer captured conversation ID rejected by the previous AST rule.

`npm test` also runs 10 bootstrap and 10 account-fence tests, including delayed nonce acknowledgement and pre-ack account boundaries. The six serialization tests bring these page-runtime tests to 26. These are runtime regressions with synthetic module sources, not evidence that the user's actual ChatGPT factory has the same source.

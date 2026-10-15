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

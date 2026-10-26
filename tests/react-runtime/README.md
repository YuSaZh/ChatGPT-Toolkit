# React runtime validation

This isolated development environment uses pinned React 19.2.0, jsdom and esbuild. Its dependencies are never loaded by the installed userscript.

Run from the repository root:

```sh
npm --prefix tests/react-runtime ci --ignore-scripts
npm run test:react
```

For the current inline message path only:

```sh
node --test tests/react-runtime/passive-inline.test.cjs
```

## Coverage

- Actual production React reconciliation, SSR hydration, useId and deep message components.
- Query-style state and useSyncExternalStore snapshots, without increasing application snapshot calls.
- Current branch selection during shared-child bailouts and pending concurrent renders.
- Inline model / effort / time labels, updates, SPA navigation, display preferences and account fences.
- No message scans for typing, sidebar changes, style changes, idle housekeeping or disabled display.
- Isolated transformer / page-bridge behavior, source identity and bootstrap acknowledgement.
- Deliberate hydration-mismatch reproductions that explain why the module bridge stays inactive in production.

The fixtures use synthetic messages and blocked or counted network calls. They do not verify authenticated ChatGPT data, Tampermonkey permissions, live browser layout, microphone interaction or WebDAV servers.

Repository layout and build commands are described in the [development guide](../../docs/DEVELOPMENT.md). Actual browser evidence and unverified scenarios are listed in the [validation record](../../docs/VALIDATION.md).

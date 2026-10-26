# Metadata transformer

[Development guide](DEVELOPMENT.md) · [Validation record](VALIDATION.md)

The standalone modules in `src/metadata/` support isolated metadata-runtime validation and reproducible builds. The production userscript does not start this module bridge: its message labels read committed native snapshots and append owned inline spans.

## Source layout

| File | Purpose |
| :--- | :--- |
| `module-metadata-transform.cjs` | Independent MIT source transformer using Acorn |
| `module-metadata-transform.browser.js` | Generated browser expression with the pinned parser and license |
| `metadata-page-runtime.cjs` | Isolated page-runtime implementation |
| `metadata-page-bootstrap.cjs` | Page acknowledgement and control bridge |

The transformer parses a factory without evaluating it or invoking application functions. It does not fetch, require, subscribe to or inspect an application module during transformation.

It supports uniquely identified mapping calls, message components and conversation boundaries. Binding checks reject shadowed or mutable ambiguous references, dynamic scope, unsupported syntax and mixed module roles. A rejected source remains unchanged.

The runtime checks use synthetic module sources and actual React packages. They do not authorize enabling the bridge in production or prove compatibility with an authenticated ChatGPT build.

## Build

Run from the repository root:

```sh
npm run build:metadata
npm run check
```

The build reads the unchanged Acorn 8.17.0 parser in `vendor/acorn/`, validates its pinned SHA-256, and preserves its MIT notice. It does not download runtime code.

To reproduce the vendored parser itself, `tools/vendor-acorn.cjs` requires the documented official Node.js v24.19.0 source bytes. Ordinary builds only need the checked-in parser. See [Acorn source and license](../vendor/acorn/README.md).

Targeted transformer checks:

```sh
node --test tests/unit/module-metadata-transform.test.cjs
```

The generated code embedded in the installable userscript is checked by `tools/build-page-metadata.cjs --check`. Keep source changes and generated artifacts synchronized.

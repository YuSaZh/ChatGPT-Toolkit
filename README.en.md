<div align="center">

<img src="docs/assets/banner.svg" alt="ChatGPT Toolkit — local usage, message details and optional sync" width="100%">

A clearer view of usage and message details on ChatGPT.

[简体中文](README.md) · [日本語](README.ja.md) · **English**

**[Install / Update](https://raw.githubusercontent.com/YuSaZh/ChatGPT-Toolkit/main/chatgpt-pro-counter.user.js)** · [User guide (中文)](docs/guide.zh-CN.md) · [Changelog](CHANGELOG.md) · [Report an issue](https://github.com/YuSaZh/ChatGPT-Toolkit/issues)

`v1.1.24`　`Tampermonkey`　`Local first`　`MIT`

</div>

---

ChatGPT Toolkit is an independent userscript for **chatgpt.com**, with a local Pro usage counter, inline message details, passively observed quota information and optional WebDAV sync.

> **Pro usage is a local estimate, not an official remaining quota.** This project is not affiliated with or endorsed by OpenAI.

## Features

| Feature | What it provides |
| :--- | :--- |
| **Pro usage** | Seven-day statistics, estimated remaining usage, pending states and manual corrections |
| **Message details** | Actual response model, thinking effort and local time beside each message; missing values are never guessed |
| **Usage hover card** | Usage on the Send / Start voice buttons, with Pro-only or all-model display options |
| **Images & PoW** | Image generations remaining, PoW difficulty and capture time from the page's own responses |
| **Ledgers & backups** | Manual ledgers, experimental automatic account detection, JSON import/export and 12 automatic backups |
| **WebDAV sync** | Merge records and period settings across devices after configuring your own server |

The compact panel follows light and dark themes. Its record list scrolls independently, message labels stay inline, and idle pages do not repeatedly scan for labels.

## Interface preview

These screenshots show the Chinese interface.

<table>
<tr>
<td width="50%" valign="top">

<h3>Usage hover card</h3>
<p>Hover over Send or Start voice to check your local usage estimate.</p>
<img src="docs/assets/screenshots/usage-card.png" alt="Usage hover card" width="100%">

<h3>Message details</h3>
<p>The actual response model and time appear beside the message actions.</p>
<img src="docs/assets/screenshots/message-info.png" alt="Message details" width="100%">

</td>
<td width="50%" valign="top">

<h3>Floating panel</h3>
<p>Manage usage, records, settings and sync in one place.</p>
<img src="docs/assets/screenshots/usage-panel.png" alt="Floating panel" width="100%">

</td>
</tr>
</table>

## Get started

1. Install [Tampermonkey](https://www.tampermonkey.net/). WebDAV requires **5.5.1+**.
2. **[Install ChatGPT Toolkit](https://raw.githubusercontent.com/YuSaZh/ChatGPT-Toolkit/main/chatgpt-pro-counter.user.js)**, confirm installation, then reload ChatGPT.
3. Open the counter in the bottom-right corner and configure your actual limit, period anchor and usage before installation.

The default limit of `100` is only an editable starting value. Historical usage is not backfilled, and opening or refreshing a conversation does not increase the count.

Before updating, export a backup and update the **existing Tampermonkey entry**. If a duplicate appears, preserve the original entry and follow the [update instructions (中文)](docs/guide.zh-CN.md#安装与升级).

## Data & sync

- Keep the **latest 1,000 records locally**, across all ledgers. The oldest records are removed after a backup; automatic backups rotate through **12 slots**.
- Counts and exports use retained records. If one counting period exceeds 1,000 records, removed records no longer contribute to its count.
- **WebDAV is off by default.** Once enabled, it syncs only to your configured server. Local retention does not delete remote history.
- Chat text, cookies, ChatGPT login tokens and raw responses are not stored. WebDAV credentials stay in the local userscript manager and are excluded from exports and sync files.
- Image and PoW values are the latest valid captures in the current page. A full reload or account boundary requires a new natural capture; no quota queries are sent.

See the [user guide (中文)](docs/guide.zh-CN.md) and [privacy and security notes (中文)](SECURITY.md) for configuration and data boundaries.

## Documentation

| Document | Contents |
| :--- | :--- |
| [User guide (中文)](docs/guide.zh-CN.md) | Installation, settings, counting, backups, sync and troubleshooting |
| [Development guide (中文)](docs/DEVELOPMENT.md) | Repository layout, builds, tests and synthetic fixtures |
| [Changelog (中文)](CHANGELOG.md) | Release history |
| [Validation record (中文)](docs/VALIDATION.md) | Verified environments, measured performance and remaining gaps |
| [Privacy & security (中文)](SECURITY.md) | Passive observation, storage, account isolation and network behavior |

## Compatibility

Message labels, updates to the original script entry and single-device InfiniCLOUD sync have been checked with Vivaldi / Tampermonkey. Automatic account detection, live message streaming and concurrent sync across two devices still need further verification; see the [validation record (中文)](docs/VALIDATION.md).

ChatGPT's page structure and internal fields may change. Unobserved requests, app usage and other browsers are not counted automatically. For troubleshooting, use “诊断 Pro 计数器” or “检查本机计数数据” in Tampermonkey and share only the redacted summary.

---

An independent [MIT](LICENSE) project. The bundled Acorn parser retains its [MIT license](vendor/acorn/LICENSE).

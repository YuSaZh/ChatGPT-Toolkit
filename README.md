<div align="center">

<img src="docs/assets/banner.svg" alt="ChatGPT Toolkit — 本机用量、消息信息与可选同步" width="100%">

让 ChatGPT 网页上的用量和消息信息更清楚。

**简体中文** · [日本語](README.ja.md) · [English](README.en.md)

**[安装 / 更新](https://raw.githubusercontent.com/YuSaZh/ChatGPT-Toolkit/main/chatgpt-pro-counter.user.js)** · [使用指南](docs/guide.zh-CN.md) · [更新记录](CHANGELOG.md) · [反馈问题](https://github.com/YuSaZh/ChatGPT-Toolkit/issues)

`v1.1.24`　`Tampermonkey`　`本机优先`　`MIT`

</div>

---

ChatGPT Toolkit 是用于 **chatgpt.com** 的独立用户脚本，提供 Pro 本机计数、消息模型与时间标签、被动额度状态和可选 WebDAV 同步。

> **Pro 次数是本机估算，不是官方剩余额度。** 项目与 OpenAI 无隶属或背书关系。

## 功能一览

| 功能 | 你可以看到什么 |
| :--- | :--- |
| **Pro 用量** | 七天统计、估算剩余、待确认状态，以及手动校准 |
| **消息信息** | 消息后的实际模型、思考强度与本地时间；缺失时不猜测 |
| **用量悬浮卡** | 悬停发送或“开始语音”按钮查看用量，支持仅 Pro / 所有模型 |
| **图片与 PoW** | 页面自然返回的图片剩余次数、PoW 难度及最近捕获时间 |
| **账本与备份** | 手动账本、实验自动分账、JSON 导入导出与 12 份自动备份 |
| **WebDAV 同步** | 自行配置后，在多台设备间合并记录和周期设置 |

紧凑面板适配深浅主题。记录列表独立滚动，消息标签随原消息内联排版；页面静止时不反复扫描标签。

## 界面展示

<table>
<tr>
<td width="50%" valign="top">

<h3>悬浮用量卡片</h3>
<p>悬停发送或开始语音按钮，快速查看本机用量估算。</p>
<img src="docs/assets/screenshots/usage-card.png" alt="悬浮用量卡片" width="100%">

<h3>消息信息扩展</h3>
<p>实际响应模型与时间直接显示在消息操作区。</p>
<img src="docs/assets/screenshots/message-info.png" alt="消息信息扩展" width="100%">

</td>
<td width="50%" valign="top">

<h3>悬浮面板</h3>
<p>集中管理用量、记录、设置与同步。</p>
<img src="docs/assets/screenshots/usage-panel.png" alt="悬浮面板" width="100%">

</td>
</tr>
</table>

## 开始使用

1. 安装 [Tampermonkey（篡改猴）](https://www.tampermonkey.net/)。WebDAV 功能要求 **5.5.1+**。
2. **[安装 ChatGPT Toolkit](https://raw.githubusercontent.com/YuSaZh/ChatGPT-Toolkit/main/chatgpt-pro-counter.user.js)**，确认后刷新 ChatGPT。
3. 点击右下角用量入口，在“设置”中填写实际上限、周期锚点和安装前的已用量。

默认上限 `100` 只是可修改的初始值。历史对话不会补算用量，打开或刷新对话不会增加计数。

**更新前先导出备份，并从原篡改猴条目检查更新。** 如果安装页显示新条目或重复副本，保留原条目，按[升级说明](docs/guide.zh-CN.md#安装与升级)处理。

## 数据与同步

- **本机保留最新 1000 条记录**，所有账本合计；超限前先备份，再清理最旧记录。自动备份保留 **12 份**。
- 计数和导出基于保留记录。如果同一统计周期内超过 1000 条，被淘汰的旧记录将不再计入。
- **WebDAV 默认关闭**。启用后仅向你填写的服务器同步；本机清理不会删除远端历史。
- 不保存聊天正文、Cookie、ChatGPT 登录令牌或原始响应。WebDAV 凭据只保存在本机脚本管理器，不进入导出和同步文件。
- 图片与 PoW 只显示本页最近捕获值。整页刷新或账号边界后需要重新捕获，不主动查询。

同步配置、自动分账和读取范围详见[使用指南](docs/guide.zh-CN.md)与[隐私和安全说明](SECURITY.md)。

## 文档导航

| 文档 | 内容 |
| :--- | :--- |
| [使用指南](docs/guide.zh-CN.md) | 安装升级、界面设置、计数规则、备份、同步与常见问题 |
| [开发指南](docs/DEVELOPMENT.md) | 目录结构、构建、测试与合成页面 |
| [更新记录](CHANGELOG.md) | 各版本改动 |
| [验证记录](docs/VALIDATION.md) | 已验证的环境、性能数据与尚未覆盖的场景 |
| [隐私与安全](SECURITY.md) | 被动读取、存储、账号隔离与网络行为 |

## 兼容性

当前版本已在 Vivaldi / Tampermonkey 中验证消息标签、原条目升级及 InfiniCLOUD 单设备同步。自动分账、真实新消息流和双设备并发仍需进一步验收，具体范围见[验证记录](docs/VALIDATION.md)。

ChatGPT 页面结构和内部字段可能变化；未观察到的请求、App 使用和跨浏览器用量不会自动补算。遇到异常可先运行篡改猴菜单中的“诊断 Pro 计数器”或“检查本机计数数据”，分享脱敏摘要即可。

---

独立 [MIT](LICENSE) 项目。内置 Acorn 保留其 [MIT 许可证](vendor/acorn/LICENSE)。

感谢 [Linux DO](https://linux.do) 社区。

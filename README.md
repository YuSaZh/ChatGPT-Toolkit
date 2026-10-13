# GPT-Pro-Counter

非官方 ChatGPT Pro 本机计数器，支持七天统计、手动校准、导入导出和可选 WebDAV 同步。

**1.1.5 实验预览：仅当前输入框选中 Pro 时显示发送悬停卡；Pro 剩余下方新增较小的图片剩余行。** Pro 次数仍是本机估算；图片值只被动读取本页响应，不主动查询。与 OpenAI 无隶属或背书关系。

## 安装

1. 从 [Tampermonkey（篡改猴）官网](https://www.tampermonkey.net/) 安装适合浏览器的扩展。
2. **[点击安装 / 更新 GPT Pro Counter](https://raw.githubusercontent.com/YuSaZh/GPT-Pro-Counter/main/chatgpt-pro-counter.user.js)**。
3. 在 Tampermonkey 安装页确认后刷新 ChatGPT。正常启动后右下角会出现计数入口；在“设置”中填写实际上限、周期锚点和已用量。默认 `100` 只是可修改的初始设置，不代表官方额度。

已有旧版本：核对安装页是在更新原来的“ChatGPT Pro 本机计数器”，不要先删除旧脚本或另建重复副本。未识别为更新时，可在 Tampermonkey 中编辑原脚本，用安装链接的全部内容覆盖并保存。重要记录建议先导出备份。

## 从 GitHub 更新

本版本已配置 GitHub `main` 分支为 `@updateURL` 和 `@downloadURL`，并保留原脚本名称、命名空间和 `gpc.v1.` 存储键。**从 ZIP 或粘贴方式安装的旧版本，需要先手动更新到本版本一次。** 只修改 README 不会改变已安装脚本。

之后可在 Tampermonkey 中检查更新；自动检查是否运行及其间隔取决于你的 Tampermonkey 更新设置。新版本发布时会提高 `@version`。这两个地址负责分发脚本源码，不会上传你的计数记录或 WebDAV 配置。

配置说明：[Tampermonkey 更新地址与下载地址文档](https://www.tampermonkey.net/documentation.php?q=update_url)。

## 界面不显示时

更新并刷新后，打开 Tampermonkey 扩展菜单：

- “显示 Pro 计数器”：尝试恢复入口并打开面板。
- “诊断 Pro 计数器”：显示版本、启动阶段、页面检查、接口状态和脱敏错误类型；新增悬停监听、可见输入框 / 模型标记 / 发送锚点数量、最近匹配原因与浮卡状态。分享排障信息时，优先提供这份诊断，不要发送完整存储、WebDAV 配置或聊天内容。

如果两项菜单都没有出现，先核对脚本版本、匹配网址、启用状态，以及浏览器的 [用户脚本执行权限](https://www.tampermonkey.net/faq.php#Q209)。诊断功能本身也需要脚本管理器成功执行脚本，不能绕过浏览器限制。

## 本版界面

发送按钮继续按已报告的发送标签、submit 类型、composer 类直接定位。显示浮卡还必须在同一个输入区找到当前可见的 Pro 选择标签；Thinking、Auto、其他模型或无法确认时不显示，已打开的卡也会随模型切换收起。隐藏测量文字、订阅名称、历史请求和默认模型都不能替代当前选择。无需把发送按钮放在输入框的祖先链内，但仍须证明模型选择器与发送按钮属于同一个输入区。真实扩展与网页仍待验收。

- 当前选中 Pro 时，悬停或键盘聚焦发送 / 模型按钮会显示 Pro 本机估算剩余，以及已用量 / 自定义上限。原生菜单、发送和快捷键不变。
- 大号 Pro 剩余下方显示较小的灰色“图片剩余”。只有页面自己的 `POST /backend-api/conversation/init` 成功响应含有效的 `image_gen.remaining` 才显示数字及读取时间；否则显示“暂未获取”，不会猜测总额、无限额度或重置周期。数值是最近读取的快照。
- 点击面板之外自动收起；入口保留，Esc 也可关闭。设置 / 同步表单的未保存内容只暂存在当前页面内存，重新点入口可继续；关闭不会保存或上传，刷新页面会丢弃草稿。
- 本页新请求首次计入 Pro 时，出现约 1 秒的 `+1` 提示；已计入消息的重试、重复响应、启动、导入、同步和手动校准不触发。后续观察到失败导致计数回退时，撤销尚未结束的提示。它表示本机记录变化，不代表官方扣额。
- 自动适配深浅主题及减少动态效果设置。网页结构变化时可能暂时识别不到原生控件，右下角入口仍可管理用量。

## 图片额度与隐私

图片额度仅在当前页面内存保留最多 60 秒，不保存到脚本存储、导出、备份或 WebDAV，也不跨标签页共享。新初始化、发送、账号 / 会话请求、离开页面、导航或输入区外的交互会清除旧值；普通输入和悬停不会清除。脚本不额外请求接口，不读取或复制登录令牌、Cookie、账号标识，也不在后台轮询。

因此某些时候只会显示“暂未获取”，直到 ChatGPT 页面自然返回新的额度响应。该内部字段可能变化，本版未用真实账号验证返回行为。公开响应字段核对自 [ChatGPT Checker Next 的被动额度观察](https://github.com/zetaloop/chatgpt-checker-next/blob/0d7bf4a941ffa1dfa0c2bf7d3005a64be8a20825/chatgpt-checker-next.user.js#L4759-L4781)；只参考协议事实，未复制或运行该项目的 AGPL 代码。

## 被动只读边界

ChatGPT 部分只转发并观察网页本来发起的请求，不主动查询、重试、自动发送、切换模型或启用工具。保持原 fetch 参数、Promise / Response 和中断语义；只读取有上限的副本。Pro 计数为辨别模型和去重仍会读取已有请求的必要元数据，不保存聊天正文。

既有 WebDAV 是单独的主动同步功能，默认关闭；用户以前明确启用的配置升级后仍保留。要完全避免脚本主动联网，请保持关闭或清除已有配置。完整调用点、数据范围和验证限制见 [被动观察与网络审查](SECURITY.md)。

## 使用和限制

- 只记录安装后、脚本运行时观察到的请求，不会补算历史、跨浏览器或 App 的使用。
- HTTP 接收不等于官方扣额成功；模型未知、失败、取消等状态需结合实际情况手动校准。
- 默认不启用 WebDAV；只有自行配置并同意后，才向指定服务同步计数和周期设置。
- 不保存聊天正文、Cookie 或 ChatGPT 登录令牌。WebDAV 凭据保存在本机脚本管理器中，不包含在脚本导出或远端计数文件内。
- `@connect *` 用于支持自选 WebDAV 服务；不需要同步时可保持关闭。WebDAV 功能要求 Tampermonkey 5.5.1+，且服务端支持强 ETag 和条件写入。

完整说明：[中文使用指南](README.zh-CN.md) · [更新记录](CHANGELOG.md) · [验证记录](docs/VALIDATION.md) · [反馈问题](https://github.com/YuSaZh/GPT-Pro-Counter/issues)

## 开发和测试

使用近期 Node.js（建议 Node.js 22+）：

```sh
node --check chatgpt-pro-counter.user.js
node --test *.test.cjs
```

可选浏览器合成测试需要 Playwright 和 Chromium：

```sh
node ui-smoke.cjs
node audit-bootstrap.cjs
node ui-send-smoke.cjs
```

测试页面和网络响应均为模拟数据，不连接真实 ChatGPT 账号，也不验证实际 Tampermonkey 扩展的注入行为。`ui-fixture.html` 可用来手工查看合成界面。

[MIT License](LICENSE)

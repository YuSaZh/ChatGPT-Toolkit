# GPT-Pro-Counter

非官方 ChatGPT Pro 本机计数器，支持七天统计、手动校准、导入导出和可选 WebDAV 同步。

**1.1.4 实验预览：直接悬停发送按钮查看剩余次数；右下角面板点击外部自动收起。** 本工具不查询官方剩余额度，与 OpenAI 无隶属或背书关系。

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

本版优先使用已报告的发送按钮属性（发送标签、submit 类型、composer 按钮类）直接定位，不再要求先找到输入框或其外围层级。每个原生控件直接监听进入 / 聚焦事件，页面替换按钮时自动重新绑定；仍保留旧版 Pro / 思考强度识别兼容。真实扩展与网页仍待验收。

- 鼠标悬停或键盘聚焦发送按钮，显示突出剩余次数的浮卡，以及已用量 / 自定义上限。原生菜单、发送和快捷键不变。
- 点击面板之外自动收起；入口保留，Esc 也可关闭。设置 / 同步表单的未保存内容只暂存在当前页面内存，重新点入口可继续；关闭不会保存或上传，刷新页面会丢弃草稿。
- 本页新请求首次计入 Pro 时，出现约 1 秒的 `+1` 提示；已计入消息的重试、重复响应、启动、导入、同步和手动校准不触发。后续观察到失败导致计数回退时，撤销尚未结束的提示。它表示本机记录变化，不代表官方扣额。
- 自动适配深浅主题及减少动态效果设置。网页结构变化时可能暂时识别不到原生控件，右下角入口仍可管理用量。

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

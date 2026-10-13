# GPT-Pro-Counter
Unofficial ChatGPT Pro usage counter with optional WebDAV sync. Experimental preview; current UI compatibility is under investigation. Not affiliated with OpenAI.

## 安装

1. 先从 [Tampermonkey（篡改猴）官网](https://www.tampermonkey.net/) 安装适合你浏览器的扩展。
2. **脚本安装入口待上线：** [安装 GPT Pro Counter（待上传）](https://raw.githubusercontent.com/YuSaZh/GPT-Pro-Counter/main/chatgpt-pro-counter.user.js)。

目前仓库还没有上传脚本文件，第二个链接暂时会返回 404，不能用于安装。脚本上传并完成兼容性检查后，可通过该链接打开 Tampermonkey 安装页面。

## 从 GitHub 更新

后续脚本将从本仓库的 `main` 分支发布和更新。上传源码时，需要在脚本的 `// ==UserScript==` 元信息区配置：

```javascript
// @updateURL    https://raw.githubusercontent.com/YuSaZh/GPT-Pro-Counter/main/chatgpt-pro-counter.user.js
// @downloadURL  https://raw.githubusercontent.com/YuSaZh/GPT-Pro-Counter/main/chatgpt-pro-counter.user.js
```

每次发布还需要提高脚本的 `@version` 版本号。安装带有这些配置的版本，并在 Tampermonkey 中启用脚本更新检查后，后续版本可从 GitHub 获取；也可在 Tampermonkey 中手动检查更新。

**当前状态：上述更新配置尚未写入脚本，GitHub 自动更新尚未启用。** README 中的配置示例不会改变已安装的脚本。

配置说明见 [Tampermonkey 更新地址文档](https://www.tampermonkey.net/documentation.php?q=update_url) 和 [版本号文档](https://www.tampermonkey.net/documentation.php?q=version)。

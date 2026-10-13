# 验证记录

版本：1.1.1（实验预览）  
日期：2026-10-13  
运行时：Node.js v24.19.0

## 已通过

- `node --check chatgpt-pro-counter.user.js`：语法检查通过。
- `node --test *.test.cjs`：96 项测试全部通过，无跳过。
- 发布元信息测试：版本号、GitHub 下载 / 更新链接、脚本身份和存储命名空间。
- 合成请求测试：模型分类、周期边界、去重、失败 / 取消、流读取边界与原请求语义。
- 存储与 WebDAV 测试：导入校验、凭据排除、条件写入、冲突合并、取消和存储失败保护。
- 合成 DOM 测试：启动、缺失 / 抛错的 API、安全渲染、悬停 / 键盘、关闭、节点恢复与旧数据兼容性。
- 新增启动测试：初始化失败仍保留诊断入口；报告不含凭据或私有配置；一次性 Shadow DOM / 渲染故障恢复；恢复后悬停监听只注册一次。

一次性 Shadow DOM 创建失败用例在原 1.1.0 中无法恢复，在 1.1.1 中通过。原版首次渲染失败后虽然可在周期检查中恢复绘制，但会遗漏悬停初始化；1.1.1 的重试完成了该路径。它们是可复现的代码缺陷，尚不能认定为真实安装问题的原因。

## 未完成 / 受阻

- Playwright / Chromium 合成浏览器测试：未完成。验证环境拒绝 Chromium 所需的 socket 创建；没有将此阶段标为通过。
- 真实 Tampermonkey 扩展注入：未验证。
- 真实 ChatGPT 账号与当前网页交互：未验证；界面不显示问题仍在排查。
- 真实 WebDAV 服务：未验证。测试使用模拟响应和明确的假凭据。

没有把合成 DOM 测试当作真实浏览器视觉验收，也没有用真实 Pro 请求消耗额度来测试。

## 本地复现

```sh
node --check chatgpt-pro-counter.user.js
node --test *.test.cjs
```

如机器已安装 Playwright 和 Chromium，可另外运行 `node ui-smoke.cjs`、`node audit-bootstrap.cjs`。两者默认使用 `/usr/bin/chromium`；不同系统可修改脚本中的浏览器路径。它们仍是合成页面测试，不能替代实际扩展与 ChatGPT 页面验收。

本版脚本 SHA-256：

```text
b160ed007a8d477399ecee09beea14d3444537e0bcc951c14741cbc09c9a738d
```

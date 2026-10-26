# 开发指南

[← 项目首页](../README.md) · [使用指南](guide.zh-CN.md) · [验证记录](VALIDATION.md)

## 目录结构

```text
ChatGPT-Toolkit/
├── chatgpt-pro-counter.user.js  # 直接安装的独立用户脚本
├── README*.md                  # 中文、日文与英文项目入口
├── CHANGELOG.md                # 发布记录
├── SECURITY.md                 # 隐私、安全与网络边界
├── LICENSE
├── package.json                # 开发命令，无运行时依赖
├── docs/                       # 指南、验证记录与文档图片
├── src/metadata/               # 元数据桥与转换器的独立源码
├── tests/
│   ├── unit/                   # 无第三方依赖的 Node 测试
│   ├── fixtures/               # 共享模拟环境与合成页面
│   ├── browser/                # 可选 Playwright 验收脚本
│   └── react-runtime/          # 使用真实 React 的隔离验证环境
├── tools/                      # 构建与第三方源码校验
└── vendor/acorn/               # 固定版本的 Acorn 与许可证
```

## 常用命令

在仓库根目录使用 Node.js 22+。基础检查和单元测试不需要安装 npm 依赖。

```sh
npm run check           # 用户脚本语法与生成文件一致性
npm test                # tests/unit 下的测试
npm run build:metadata  # 重新生成转换器及内嵌元数据代码
```

只运行所需测试文件即可，例如：

```sh
node --test tests/unit/release-metadata.test.cjs
```

用户脚本仍是根目录的单文件交付，安装与更新地址保持不变。仅整理文档或开发目录时不提高用户脚本版本号。

## 元数据源码与构建

`src/metadata/` 保存独立源码与可复现的浏览器转换器。元数据桥与转换器用于隔离验证；生产启动使用用户脚本中的被动消息读取路径。

```sh
node tools/build-metadata-transform.cjs --check
node tools/build-page-metadata.cjs --check
```

需要修改时，先改独立源码，再运行 `npm run build:metadata`。生成文件不可手工修改。构建读取已入库的 Acorn，不联网下载运行时代码；解析器的校验与许可证见 [vendor/acorn](../vendor/acorn/README.md)，转换器原理见[实现说明](METADATA-TRANSFORM.md)。

## 真实 React 验证

依赖集中在 `tests/react-runtime/`，版本由其锁文件固定，不进入用户脚本。

```sh
npm --prefix tests/react-runtime ci --ignore-scripts
npm run test:react
```

仅运行当前内联标签检查：

```sh
node --test tests/react-runtime/passive-inline.test.cjs
```

这些检查使用真实 React 与 jsdom，但不代替登录态 ChatGPT、篡改猴、流式消息或双设备同步验收。详细说明见[运行时验证目录](../tests/react-runtime/README.md)。

## 可选浏览器检查

`tests/browser/` 中的脚本使用 Playwright 与合成请求，不连接真实 ChatGPT 账号或 WebDAV。部分脚本默认使用 `/usr/bin/chromium`，运行前确认本机浏览器路径及依赖。

```sh
node tests/browser/audit-bootstrap.cjs
node tests/browser/ui-send-smoke.cjs
node tests/browser/ui-smoke.cjs
```

合成界面位于 `tests/fixtures/ui-fixture.html`。当前消息形状的独立页面可用以下命令生成到忽略的 `artifacts/`：

```sh
node tests/fixtures/ui-current-frontend-fixture.cjs
```

截图、生成的验证页面等临时产物放在 `artifacts/`，依赖目录与临时产物不提交。

## 修改约定

- 保留用户脚本文件名、`local.chatgpt.pro-counter` 命名空间和 `gpc.v1.` 存储前缀。
- 只被动读取 ChatGPT 自然返回的数据；用户自行配置的 WebDAV 是独立允许的网络功能。
- 不保存聊天正文、Cookie、令牌、原始响应或公开 WebDAV 凭据。
- 根据改动执行必要的定向检查，并明确区分合成测试与实机验收。
- 项目采用 MIT；复用第三方实现前核对许可证，保留 Acorn 的许可文件。

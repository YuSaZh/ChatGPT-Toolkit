# ChatGPT Toolkit 验证记录

## 1.1.21 WebDAV 与面板稳定性

- 用户 Vivaldi / Tampermonkey 5.5.1 / InfiniCLOUD 实测：普通 GET 与 identity GET 都返回 200、同一份 57 条记录；普通响应启用压缩且 ETag 带压缩后缀，identity 响应未压缩、强 ETag 不同。改为 identity 后，条件 PUT 从持续 412 恢复为 204；没有修改 ETag 字符串或移除 If-Match。
- 随后复现第二个真实故障：PUT 最终回调已返回 204，篡改猴提供的空流却不结束，旧逻辑等到 20 秒超时。现在有效最终 204 / 205 直接完成并取消本工具的读取器；启动事件本身仍不能判成功，GET 200 仍等完整、有界正文，重定向仍先拒绝。
- 原条目安装完整 1.1.21 并刷新后，2026-10-18 20:48（Asia/Tokyo）实际自动同步：MKCOL 405 / 257 ms，GET 200 / 141 ms，PUT 204 / 147 ms，均完成；页面显示同步成功、合并 57 条。前一轮上传的数据已被下一轮成功读回。本机复核：57 有效记录、2 有效设置、12 有效备份、0 异常与读取失败；15 Pro +4 校准 = 19/200。
- 面板原因是可见页每 5 秒重新解析相同模板并替换整个 Shadow DOM。修复在模板及挂载节点未变时复用原节点，测试保留面板 / 样式 / 焦点 / 滚动，变化及节点丢失仍更新。实际打开面板跨多个刷新周期观察，未再出现周期性闪动。
- 547 项根回归全部通过；真实 React 运行时与 33 项既有集成检查通过。新增测试覆盖压缩 ETag 的传输路径、真实冲突重读、绝不改写 ETag、204 无 EOF、最终回调与重定向边界、稳定渲染。
- 临时只读比较菜单已从正式文件移除；诊断未保存原始响应、凭据、正文或账号信息。真实双设备并发、其他服务及更早遗失记录恢复未验收，不据单设备成功推断这些结果。

## 1.1.20 内联消息标签与真实页面诊断

- 2026-10-18 在用户 Vivaldi 登录页被动检查：当前构建 manifest-653aac85，真实消息组件深度 282～300，整棵已提交树最大深度 458。旧版 256 层扫描截断消息；修复后原生目标 2、原生元数据 2、内联标签 2。不保存正文、原始响应、账号 ID 或凭据。
- 保留 24,000 总节点预算，深度上限改为 1024；没有启动旧模块注入、React 包装或额外 fetch 桥。生产读取器只用已提交身份及已存快照，不调用 getter / subscribe / require。标签在原生树提交后追加到操作按钮后，采用 position:static 随文档流排列；原有节点、属性、sourcesAction 与 useId 路径保留。
- 根目录 540 项回归全部通过。真实 React 两套历史运行时继续通过，另有 33 项页面桥历史、安全与新显示层测试通过。新增完整脚本 SSR → hydrateRoot 在 12 / 320 层测试：0 hydration recovery，原有节点 / useId / 空操作栏条件保持；不增加组件或 getSnapshot 调用；流式样式的原生提交、SPA、显示开关正常，0 主动请求。另验证 thinking_effort 白名单及今天、前七天、八天前、跨年和未来日期边界。
- 模型控件及其文本 / SVG / 焦点在 Pro-only 和 all 模式下均不打开浮卡；发送与开始语音继续显示，听写 / 停止排除。原存储身份、备份和 WebDAV 核心不变。
- 真实环境：前一轮已验证当前安装 57 条有效记录、12 份有效备份、19/200；导出文件通过 v1 格式校验，刷新保留 19/200。WebDAV 为 GET 200 / PUT 412，尚未解决条件写入原因，也未进行双设备同步。当前 Vivaldi 页预览实测助手标签 gpt-6-thinking max 14:02、用户时间 14:01，均为 static，助手标签与 5 个原生按钮同一父节点。预览成功不等于已完成扩展升级、切账号、新消息流的全部验收；后续结果应单独追加。
- Windows core.autocrlf=true 会改变检出文件的换行。构建校验按 Git 中的 LF 规范化再比较，保留原 Acorn SHA-256 校验，不改 parser 代码或许可证。
- 正式安装验收：用户已授权后推送 main，在 Vivaldi 的 Tampermonkey 5.5.1 更新页核对“已安装 1.1.19 → 1.1.20”，使用“更新”原条目。整页刷新清除临时预览后，实际显示 gpt-6-thinking max 14:02，原计数仍为 19/200（15 Pro +4 校准）。公开 raw 安装文件与本地发布文件逐字一致。
- 实际空输入框：临时选择“所有模型”，键盘聚焦模型入口仅出现原生思考强度提示，没有 Toolkit 用量卡；聚焦开始语音显示 19/200、估算剩余 181，点击外部正常关闭。随后恢复原“仅选择 Pro 时”偏好。没有发送消息、切换模型或启动语音。切账号、新生成消息流、历史星期/日期的真实样本及双设备同步仍未完成，不能用上述验收替代。
- 实际 SPA：进入空白新对话后没有残留旧消息标签，返回原对话后恢复 gpt-6-thinking max 14:02，全程计数保持 19/200。

## 1.1.19 SSR 安全回退验证

- 实际错误日志共 18 次 ERR_BLOCKED_BY_CLIENT，全部为统计上报 /ces/v1/rgstr，约 30 秒；每个请求栈中 Toolkit 两个观察层各一次，没有同步递归 / Maximum update depth / RangeError 证据。另有一次 React #418。只记录脱敏统计，不发布原始用户日志。
- [React 官方 #418](https://react.dev/errors/418) 指服务端内容与客户端 hydration 不匹配，并可能重建组件树。独立真实 React 19.2 SSR → hydrateRoot 实验：额外用户消息 Fragment 使嵌套 useId 从服务端路径变化，引发 text mismatch；助手 sourcesAction 的 truthy Fragment 也能使条件操作栏新增，引发 HTML mismatch。Label 返回 null、甚至不读取 mapping 时仍可能发生，单独关闭显示不足以修复。
- 本版在完整脚本启动入口禁止 metadata bridge / 原生读取 / 标签挂载，不写原显示偏好；保留计数、备份、WebDAV 和悬停。测试覆盖页面注入零安装、原 Function.call 不变、仅原计数 fetch 观察层、旧消息响应不采集 / 不挂标签、偏好与账本原值保留。
- 完整根回归 536 项通过；真实 React 两套运行时以及页面桥 / SSR / 完整启动安全闸共 31 项通过。语法与生成一致性检查通过。SSR 反例仅在测试中显式调用已停用的旧模块，生产启动不得执行该路径。
- 这是已复现结构风险的安全回退，不宣称用户的全部 #418 或统计拦截错误都来自本工具，也不保证关闭它会停止网站自己的统计重试。原始用户页面布局、其他扩展组合仍未实际验收。

## 1.1.18 数据入口与页面语义验证

- 用户 1.1.17 诊断显示页面 ack / webpack / 工厂注入已运行，两个目标模块、9 次原生挂载，但没有 mapping；账号观察显示 ready / not-active。由此不再把整段 bootstrap 失败作为本次解释。具体数据模块源码尚不可见，两个模块可能来自 AST 拒绝或早已缓存，新增分项状态用于区分。
- 独立复现旧 AST 拒绝参考可识别的外层闭包 ID 和本地 ID；现在在原调用点通过 observeCall 透明转发同一次调用，callee → selector → ID 各求值一次。覆盖属性 getter 修改 ID / callee、getter 自身修改 ID、严格 / 非严格 this、Proxy apply、原异常与返回身份。真实 webpack → AST → 内联编译 → React 模块验证也改用旧实现拒绝的闭包形状。
- 独立序列化页面 realm 复现旧 runtime 将原严格组件的 undefined this 改为 window；函数体内严格模式与编译脚本严格模式现已修正。测试通过实际 toString / 页面脚本执行，不只测试 CJS require。
- 模拟 fetch 每次读回不同代理但 setter 实际生效的场景：安装时保持 waiting-fence；只有页面自行调用到达后才开放标签，原 fetch 一次、原 Promise / this / 参数 / 错误不变。真正 hard account pause 不会由此解除；不可写且未到达时仍隐藏，不发探测请求。该场景证明兼容逻辑，不代表已识别用户环境具体包装方式。
- 新悬停回归覆盖明确语音入口、同表单唯一 peer 的无 editor 模型入口、Pro-only / all、跨 form 不混用模型、隐藏 / 排除区域、固定诊断与状态无副作用，零点击 / 请求 / 麦克风调用。
- 独立完整执行：根目录 `node --test *.test.cjs` 共 536 项；`validation/react-runtime` 两套真实 React 验证，以及 bootstrap / account / serialized 共 26 项全部通过。可复现构建、Acorn 校验及语法检查通过。
- 未登录或操作真实 ChatGPT / WebDAV；公开未登录构建仍与用户 webpack 构建不同。没有把公开构建或 jsdom 当成用户页验收，没有重试先前受限的浏览器沙箱路径。真实标签、Tampermonkey、布局和语音悬停仍以用户更新刷新后结果为准。

## 1.1.17 模块注入验证

- 根目录 Node 回归：515 项全部通过；另有真实 React运行时与独立page bootstrap/fetch回归。构建、语法、依赖许可检查均独立运行。

- 重新核对固定 [Checker Next 5.2.2](https://github.com/zetaloop/chatgpt-checker-next/blob/5ad36f8340c132e907e72300a7adaa81824cae9b/chatgpt-checker-next.user.js)：其注入开关决定 document-start webpack 工厂处理，AppScope 与 MessageInfo 由注入建立；普通现存 Fiber 快照不保证等价。参考只展示 get/watch 的调用，没有 selector/store 实现，因此本工具改为旁读原生已求值的 mapping，而不是主动调用这些方法。
- 新 `module-metadata-transform.cjs` 使用 MIT Acorn，独立解析有来源依据的唯一 AST 绑定；回归覆盖 this/参数/返回/异常、可写 ID 拒绝、歧义拒绝、工厂语法和边界 React 加载顺序。浏览器解析器与内嵌主脚本均有可复现构建检查。
- `validation/react-runtime/run-module.cjs` 使用真实 React 19.2 production / react-dom / jsdom、原生 webpack 风格 factory.call 和本地内联脚本执行。没有旧 message DOM 属性、没有手造 Fiber / AppScope；从 page ack、工厂改写、自然 selector 一次、已提交会话一路得到两条标签。历史 A→B→A 的 A selector 未重算仍显示，开关不增加原生 renderer/getter 次数。
- 同套验证包括原 renderer null/hidden、自己的日期格式化异常、旧对象及首次迟到的新对象账号回流、原 getter 异常身份、来源动作插槽和全程零 fetch/XHR/socket。账号暂停需要用户自然刷新，不声称无缝切号恢复。
- 这次没有可用的用户登录态浏览器；没有重新尝试先前被拒的 Chromium 沙箱绕过。jsdom 不验证 Tampermonkey/CSP 实际权限、用户构建 factory 的完整形状或浏览器视觉布局。因此必须以用户更新刷新后的显示/诊断确认最终适配结果。


版本：1.1.16（实验预览）
日期：2026-10-15
运行时：Node.js v24.19.0

## 1.1.16 已通过与验证限制

- 用户反馈 1.1.15 仍没有标签，新诊断为旧消息节点、新版消息组件、原生路径和快照均 0。该结果不能单独证明 sandbox 错误；可见模型 / 发送计数还受旧编辑器与偏好过滤影响。本版增加原始 DOM 锚点、React 宿主 / 根 / 已提交结构及未过滤模型 / 发送 / 语音开始数量，报告不含页面内容或身份。
- [React 官方 TreeReflection](https://github.com/facebook/react/blob/v19.2.0/packages/react-reconciler/src/ReactFiberTreeReflection.js) 明确处理共享子树。真实 React 19.2 production + react-dom / jsdom（没有手工创建 Fiber）运行：初次渲染及 5 次普通 commit 正常；startTransition 遇到尚未完成的 Suspense 时，DOM 历史消息仍在，1.1.15 的严格 return 算法变为 0 路径 / 0 目标，正向 root.current 索引持续得到 2 个目标 / 2 个标签，0 请求。普通完成后的 memo bailout 不一定触发，因此不声称所有重绘都会失败。
- 可复现运行时验证见 `validation/react-runtime/README.md`。它使用开发期固定版本 npm 包；用户脚本没有运行时依赖。这是实际 React 行为和 jsdom DOM 验证，不是 Chromium 布局、Tampermonkey 或用户 ChatGPT 登录页验收。
- `node --test *.test.cjs`：480 项通过，0 失败、0 跳过。新增 9 项提交树 / document 视图回归、15 项精确语音 DOM / 焦点 / 指针 / 模型偏好 / 按钮切换 / 无自动请求回归、1 项 page-context 元信息检查。旧边界测试改用新索引的 256 深度 / 24,000 总节点上限；未放宽账号、内容读取或 getter 限制。
- 本机 Node 性能补测：23,908 个已提交 Fiber、12 轮渲染，中位约 18.9 毫秒、最高约 59.3 毫秒；真实浏览器开销不能据此保证。仍有 200 毫秒合并窗口和有限遍历预算。
- 新索引从最多 24 个 current 根正向构造规范父链，隐藏子树不访问；优先精确当前 renderedTurns 边界。旧 return 仅用于找到 root.current，不用于证明已提交祖先。多根、主容器不是 React host、共享旧子节点 / 新父快照、历史切换、同宿主重复渲染和访问器陷阱均覆盖。
- [Tampermonkey 官方 sandbox 文档](https://www.tampermonkey.net/documentation.php?ext=hinc&q=sandbox) 说明 raw 请求 MAIN_WORLD，JavaScript 在 Firefox 使用 USERSCRIPT_WORLD 且对象跨界可能需特殊处理。本版 raw + unsafeWindow.document 是有依据的兼容修正；不保证管理器 / CSP 必然按预期注入，没有通过自行 eval 或绕过安全策略强行注入。
- 独立审查本次尝试正常 Chromium 验证仍在启动阶段遇到 IPC socket / 环境只读挂载限制，没有进入浏览器断言或绕过限制。真实用户登录页及实际布局仍未验证。网络观察、计数存储与 WebDAV 核心不变；语音悬停不触发按钮、麦克风权限或任何请求。

## 1.1.15 已通过与验证限制

- 完整核对 [Checker Next 5.2.2 固定源码](https://github.com/zetaloop/chatgpt-checker-next/blob/5ad36f8340c132e907e72300a7adaa81824cae9b/chatgpt-checker-next.user.js)：其 document-start 捕获 webpack、改写模块、捕获 AppScope，再以 mapping + item / assistantItem 身份显示；旧 data-message-id DOM 路径不是等价适配。本版没有复制这些 AGPL 模块 / 组件包装，也没有使用其模型修改、请求包装、自动批准等功能。
- 独立结构研究另核对 [AI Conversation Navigator 当前来源](https://greasyfork.org/en/scripts/545883-ai-conversation-navigator/code) 中的 query producer、当前新锚点和已物化 mapping hook；未采用其主动拉取、hydration、写状态或 getter 调用。[React 官方 ReactFiberHooks.js](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberHooks.js) 确认 useSyncExternalStore 的 memoizedState / queue.value / getSnapshot 结构。本版自己实现数据描述符读取与准确身份匹配，只读取已存值、不调用回调。
- `node --test *.test.cjs`：455 项通过，0 失败、0 跳过。新增 31 项新版前端回归 + 8 项独立审查回归；不是把旧测试重复导入计数。所有 JS / CJS 语法检查通过。原 fetch 观察器、计数 / 存储 / WebDAV 核心与发布基线保持。
- 场景覆盖旧 DOM 身份全为 0、已加载 query / mapping、历史 SPA 前进返回、准确 ID 优先级、内部 / 服务端会话对应、隐藏 / 工具消息否决、开关恢复、组件 / 宿主重挂载、未提交 alternate、访问器陷阱、快照不同步、嵌套消息、Offscreen / LegacyHidden / Activity、对话框 / 侧栏副本、重复账号失效、旧 query 回退及旧消息外壳克隆。独立审查发现的账号 / 嵌套边界问题已在发布前修复并重跑。
- 性能合成检查：23,900 个无关已提交 Fiber + 2 个消息宿主，12 轮扫描中位约 11.3 毫秒，冷轮最高约 41.8 毫秒（本机 Node，不能外推至真实浏览器）。扫描上限 24,000 个结构节点 / 500 个新版目标，优先对话子树；200 毫秒合并，不因脚注自身重复创建节点；关闭或无正式对话 ID 时不进行新版树扫描。
- 真实云浏览器可以打开 ChatGPT 公开页，但只显示未登录 unauth-mweb 页面（mobile-composer-prompt），不是参考源码针对的登录前端；没有发送消息或登录。本地浏览器 fixture 的 file:// 导航被浏览器协议策略拒绝；改用正常本地 HTTP 服务后云浏览器报 ERR_CONNECTION_REFUSED，页面断言没有运行。旧 Chromium sandbox 绕过没有重试。真实用户登录页、Tampermonkey / Firefox realm 和标签布局仍未验证，不能把合成历史切换写成真实用户页成功。
- 可用 `node ui-current-frontend-fixture.cjs` 生成本地 HTML，在自己正常开发浏览器中打开或通过本地 HTTP 服务查看；包含显示开关、历史切换、账号边界与新宿主恢复按钮。此 fixture 使用真实 DOM + 合成 Fiber，仍不是 ChatGPT 或真实 React runtime 验收。

## 1.1.14 已通过与验证限制

- 本次重新逐段读取 [Checker Next 固定版本](https://github.com/zetaloop/chatgpt-checker-next/blob/5ad36f8340c132e907e72300a7adaa81824cae9b/chatgpt-checker-next.user.js)：其消息信息直接读原生 AppScope mapping，并在 React 组件中显示。1.1.13 的后续 fetch 观察不是该实现的等价替代；开关重开也没有恢复已加载元数据的来源。
- 另核对实际公开 ChatGPT 构建 prod-a55478c3ac4c8f1df8539a0845d619d9fddce90d 的 [消息渲染资源](https://chatgpt.com/cdn/assets/8b34dbc2-nt22x0rk0pr335tb.js) 及 [消息初始化资源](https://chatgpt.com/cdn/assets/4813494d-e688mn57gf7k52mc.js)：原生渲染器接收 conversation / messages，DOM 身份来自 messages[0]，原消息初始化保留服务元数据。新适配器基于这些数据路径独立实现，没有复制组件 / 模块源代码，也没有采用参考项目的模块替换。
- 新增 32 项有来源依据的合成回归，覆盖无网络历史预填时已加载消息显示、开关重开、项目路径、新聊天 URL 转换、准确身份、当前根 / alternate / 共享父节点、隐藏 / 工具信息覆盖旧缓存、账号隔离、无 getter / 信号 / 正文读取、祖先与兄弟链边界，以及菜单数量诊断。
- `node --test *.test.cjs`：416 项通过，0 失败、0 跳过；JS / CJS 语法检查通过。旧存储 / 同步核心、fetch 观察器与持久化格式未修改。原有诊断菜单可直接查看消息节点、原生已提交路径、原生消息属性、可用元数据、隔离节点和标签数量，无需控制台代码。
- 这些验证不等于用户登录页验收。公开构建的原生结构与参考项目针对的 AppScope 构建不同；用户的构建、Tampermonkey 沙箱 / 浏览器 realm、真实布局和跨浏览器注入尚未验证。既有浏览器启动 socket 限制未绕过。未访问真实账号 / WebDAV / 凭据，未发送聊天或主动请求历史。
- 支持必须同时具备精确 DOM 消息身份、可读取的已提交消息祖先 props、原生 conversation.id 与当前 URL 相符；不调用 serverId$ 来推断客户端 / 服务端 ID。没有这些条件时继续依赖原有自然网络路径，或省略显示。账号边界后同一旧节点须等待页面替换或新自然响应；不会为了显示而放宽隔离、请求历史或改写应用状态。

## 1.1.13 已通过与验证限制

- `node --test *.test.cjs`：384 项通过，0 失败、0 跳过。其中 34 项新合成测试覆盖元数据白名单、时间类型、响应模型优先级、隐藏 / 工具消息、流中身份变化、已有响应副本复用、原 fetch Promise / this / 参数 / Response 保留、超限取消副本而原响应可读、非计数请求 / 存储失败下仍可显示。
- 另覆盖 GET / POST 精确同源端点、失败 / 重定向拒绝、旧回包与账号 / 设置 / 导航代次栅栏、首次响应前 URL 已改变的新建对话、精确消息 ID / 角色匹配、DOM 重新挂载 / 复用、无重复脚注、设置独立读取及读失败保守行为。未变化的脚注缓存渲染键，避免每次流式 DOM 变化重新格式化全部时间。
- 现有 350 项回归保持通过；本版保留本机库存 / 存储诊断函数与整个导入 / 导出 / WebDAV 核心块，与 1.1.12 逐字一致。仅新增本机布尔显示偏好，不迁移计数数据、不修复或覆盖真实历史。
- 已运行全部 JS / CJS 语法检查。所有数据均为合成数据，未登录或操作真实 ChatGPT / WebDAV，也未获得真实 Tampermonkey / 实际页面布局截图；既有 Chromium 启动的 socket 权限限制未绕过。此版本的正确性结论限于源码审查和合成协议 / DOM 测试。
- 支持的是有稳定消息 ID / 角色属性的 DOM、现有 POST JSON / SSE 及自然 GET 历史响应；并不保证 Work、WebSocket、分享 / 临时页面或未来协议。历史超过 1 MiB / 1.5 秒、流超过 256 KiB / 30 秒、字段缺失或 DOM 不匹配时省略显示，不主动补请求。仍需真实页面验收，不声称原有同步与数据问题在用户环境中已解决。

## 1.1.12 已通过与验证限制

- `node --test *.test.cjs`：350 项通过，0 失败、0 跳过。14 项新故障注入测试覆盖只读/脱敏库存、单键读取失败、坏记录/设置、静默写入失败、缺失历史备份保护、全部备份可见、空合并阻断与正数远端拉取、409/412 文案与备份次数、请求生命周期脱敏诊断、PUT 后本机读取失败阻止设置导入。
- 1.1.11 基线复现：已存 1 条 Pro 记录，对该键的 GM_getValue 注入异常后，界面变成 `Pro 0/100 本机`，记录键仍存在且没有错误提示。补丁在同一注入下显示 `Pro 待核对 权限异常`。这是明确的代码失败模式，不证明它就是任一真实归零个案的原因。
- 调整原有空文件上传测试，使正常写入路径使用实际记录；新增测试明确验证空合并不 PUT、但本机空 / 远端有记录仍可合并。保留导入合并、失败回退、页面输入 / 账号隔离 / 被动观察和全部传输边界回归。
- 不改变现有流读取与最终回调都完成后才成功的规则。官方 Tampermonkey 当前 beta 代码可见最终 onload 与结束消息，不足以证明所有版本 / 用户环境的时序；因此没有以猜测放宽完成、重定向或超时保护。
- 写后读回仅验证脚本管理器即时返回值，不证明磁盘落盘、刷新或浏览器重启后的保存。真实 Tampermonkey / 当前 ChatGPT 页面、原生浏览器和实际 WebDAV 服务仍未验收；本次没有真实账号、凭据或远端数据操作，不声称真实同步成功或记录已恢复。

## 1.1.11 历史验证记录

- `node --test *.test.cjs`：336 项通过，0 失败、0 跳过。保留此前 322 项，新增 14 项 WebDAV 流式响应生命周期回归。
- 主脚本及全部 `.cjs` 语法检查通过。独立审查另以 8 组只读模拟探针检查回调时序、最终状态、重定向、超时和限量读取，无阻塞项。
- 在 1.1.10 基线上复现：`onloadstart` 为状态 0，空流 EOF 后才触发最终 201，旧版返回 0。新版必须同时得到最终 `onload` 与完整有界流；覆盖两种结束顺序、最终 ETag、空 MKCOL / PUT、405 已存在目录、401 / 403 / 409 / 500、最终状态 0、缺失回调、晚到错误 / 取消 / 重定向、超限和无流回退。
- 集成回归覆盖状态 0 起始事件贯穿 MKCOL → GET → 条件 PUT，确认最终 ETag 用于 If-Match；真实失败停止后续 GET / PUT / 本机导入。保持 `anonymous: true`、`redirect: error`、独立计时器和原有网络调用点。
- [Tampermonkey 文档](https://www.tampermonkey.net/documentation.php?q=GM_xmlhttpRequest)区分流开始与完成回调；[维护者历史讨论](https://github.com/Tampermonkey/tampermonkey/issues/1278#issuecomment-1004614835)确认 loadstart 在 readyState 1 触发。修复依据是回调生命周期，而非放开重定向或推断密码错误。
- 真实 Windows / Tampermonkey、实际 WebDAV 服务、TLS / 代理 / 扩展权限及原生浏览器行为未验证；没有使用用户凭据或创建真实远端目录。合成复现不证明用户环境不存在其他问题。仅代码与模拟验证完成，不宣称真实服务同步成功。
- 生产代码差异限于版本和 WebDAV 传输回调；ChatGPT 被动观察、输入隔离、计数及存储格式保持。没有新增权限、主动 ChatGPT 请求或自动重试网络路径。

## 1.1.10 历史验证记录

- `node --test *.test.cjs`：322 项通过，0 失败、0 跳过。保留原有 291 项，新增 20 项输入 / 表单生命周期和 11 项独立 WebDAV 自动拉取审查回归。
- 主脚本及全部 `.cjs` 语法检查通过。
- 新合成事件模型显式覆盖 closed Shadow DOM 的宿主重定向、窗口 / document 捕获与冒泡、窗口非 Node 目标，以及外部输入框 / 其他 Shadow DOM 不受影响。原 1.1.9 在同一模拟页面粘贴处理器下可复现错误，新实现通过；也明确测试更早窗口监听无法撤销的限制。
- 覆盖 WebDAV URL / 用户名 / 密码 / select / checkbox，键盘、复制剪切粘贴、beforeinput / input、composition 事件不取消默认动作，IME Escape / legacy 229，面板关闭 / 再打开、节点恢复、异步成功 / 失败 / 切页 / 新草稿、原表单身份与设置冲突快照。
- 独立同步测试覆盖无本机改动自动拉云端、所选间隔、重复合并、同步途中本机新记录与设置、失败记录降计数、PUT 失败不导入、测试配置不合并、打开同步页状态 / 入口刷新，以及 20,001 条且小于 5 MiB 的合并禁止上传。
- `ui-v1110-smoke.cjs` 已新增并通过语法检查。一次普通 Chromium 启动仍以 `socket() failed: Operation not permitted` 退出，未进入页面断言；没有提高权限、绕过限制或记为通过。该测试保留真正 closed Shadow DOM，并准备浏览器原生键盘编辑流程；剪贴板和 IME 部分仍只是事件路由模拟。
- Node 合成默认动作回调不等于浏览器原生编辑验证。真实 Tampermonkey / 当前 ChatGPT 页面、系统剪贴板、真实输入法组合、扩展注入时序和真实 WebDAV 服务均未验证。脚本 @run-at 不能保证早于所有站点窗口监听。
- 保留 ChatGPT Toolkit 名称、namespace、下载 / 更新地址、`gpc.v1.`、v1 文件格式。未增加 ChatGPT 请求、自动发送、模型切换、PoW 求解或剪贴板读取；WebDAV 仍依赖已有明确授权配置。

## 1.1.9 历史验证记录

- 主脚本与全部 `.cjs` 语法检查通过。
- `node --test *.test.cjs`：291 项全部通过，0 失败、0 跳过。保留此前 261 项，新增 21 项独立审查与 9 项实现侧 UI 回归。
- 脚本 SHA-256 已核对，见文末。
- 浏览器合成阶段：运行 `ui-v118-smoke.cjs`，普通启动及获准提高权限后的启动均在 Chromium 启动时因 `socket() failed: Operation not permitted` 退出，未进入任何页面断言，不计为通过。
- 真实 Tampermonkey 更名升级 / 存储保留、当前 ChatGPT 网页和真实 WebDAV 服务：未验证。

计数核心、被动观察器及 PoW / 账号解析在 `decodeImport` 之前的实现与 1.1.8 基线逐字一致。

本版核验范围：

- 安装名为 `ChatGPT Toolkit`，namespace、文件名、`gpc.v1.` 键与 v1 备份格式保持；只移除记录页 PoW 解释段落和概览指定页脚，保留状态与其他安全提示。
- 旧无版本配置保留完整文件模式，含无扩展名目标；新配置使用显式版本 / 模式并默认为基础目录。基础目录拒绝重复斜杠而不折叠，完整文件模式保留重复斜杠；安全 Unicode 路径可用，已有合法编码形式保持；拒绝内嵌认证、query / fragment、编码分隔符、目录穿越和歧义百分号路径。
- 只派生固定 `ChatGPT-Toolkit/` 子目录和 `data.json`；已授权测试可 MKCOL 后 GET，201 / 405 后校验文件，409 明确提示基础目录问题且不递归建目录，错误不得接着 PUT。
- 无 Cookie / 重定向拒绝、强 ETag、`If-Match` / `If-None-Match`、最多三轮冲突合并、限时限量、本机备份失败、取消及配置变更的停止写入保护。
- 新目标首次同步只合并本机与新远端，不偷偷移动、复制或删除旧远端；旧历史需先经旧配置同步到本机再导出备份。测试读取不证明条件写入可用。

## 历史验证记录（截至 1.1.8）

以下记录描述对应旧版本的实际运行；不是 1.1.9 已通过声明。“原脚本身份 / 旧名称保留”等字样也仅指当时版本。

- 1.1.8 使用 Node.js v24.19.0；`node --check chatgpt-pro-counter.user.js`：语法检查通过。
- 1.1.8 的 `node --test *.test.cjs`：261 项测试全部通过，无跳过。
- 发布元信息测试：版本号、GitHub 下载 / 更新链接、脚本身份和存储命名空间。
- 合成请求测试：模型分类、周期边界、去重、失败 / 取消、流读取边界与原请求语义。
- 存储与 WebDAV 测试：导入校验、凭据排除、条件写入、冲突合并、取消和存储失败保护。
- 合成 DOM 测试：启动、缺失 / 抛错的 API、安全渲染、悬停 / 键盘、关闭、节点恢复与旧数据兼容性。
- 新增启动测试：初始化失败仍保留诊断入口；报告不含凭据或私有配置；一次性 Shadow DOM / 渲染故障恢复；恢复后悬停监听只注册一次。

一次性 Shadow DOM 创建失败用例在原 1.1.0 中无法恢复，在 1.1.1 中通过。原版首次渲染失败后虽然可在周期检查中恢复绘制，但会遗漏悬停初始化；1.1.1 的重试完成了该路径。它们是可复现的代码缺陷，尚不能认定为真实安装问题的原因。

## 1.1.2 新增验证

- 22 项独立回归覆盖：发送按钮语义定位、SVG/path 命中、非 button Pro 下拉、内层角色控件、输入框范围限制、语音/停止排除、键盘与原生点击、SPA 节点替换和剩余次数显示。
- 模拟网络响应覆盖：HTTP 接收新增计数、未知模型明确解析为 Pro、重复元数据和重试去重、早期错误取消尚未绘制的提示、后期流错误及模型冲突移除可见提示、历史记录/手动校准/Thinking/失败不触发、handoff 保留已有计数；并发独立请求逐次提示、存储失败不误提示，以及快速失败后重试成功的首次提示。
- `+1` 表示本机计数增加，遵循原有 HTTP 接收记账语义，不声称是官方扣额成功。后续错误可导致本机回退并撤销提示；没有为动画改变计数或请求逻辑。
- 动效层不接收鼠标点击，约 1.1 秒移除；减少动态效果时保留静态短提示。主题及样式规则已做合成断言，未完成真实视觉验收。

## 1.1.3 新增验证

- 17 项独立实际按钮回归采用用户报告的关键属性、嵌套标签、`aria-hidden` 测量文字与 SVG/use 后代；外围 form / composer 层级是合成变化，不能据此声称已取得实际页面祖先结构。
- v1.1.2 对 `思考强度Pro` 的中文关键词本来就能命中，原始按钮片段放在简单 form 中能通过。已复现的旧版缺陷是：近层背景 / 输入框容器阻断外层 form，或近层 form 阻断外层已知 / 近邻输入框容器；属性识别不再依赖本地化文案。不能把这些合成缺陷认定为真实页面故障的唯一原因。
- 回归同时覆盖键盘聚焦、原生快捷键 / 点击、Pro 文本到 SVG/use 和按钮空白区域的移动、SPA 替换、侧栏 / 顶栏排除、语音 / 停止排除及独立 form 隔离。
- 用量卡优先放在 Pro 上方；退到下方时留出原生快捷键提示区域，视口不足时限制卡片高度。没有隐藏、改写或移除页面原生提示。几何及保留 DOM 行为通过合成断言，尚未完成真实浏览器视觉验收。
- 新增悬停诊断固定状态标签与数量；测试确认不包含控件文案、页面 URL、DOM、聊天文字或凭据，且悬停不会新增持久化存储记录。
- 源码差异局限于版本、悬停控件 / 范围识别、位置和诊断；计数、网络观察、鉴权 / WebDAV、存储及 +1 队列逻辑未更改。相关原有测试全部重新通过。
- 手工合成页面已加入已报告的按钮关键属性和下方原生提示；该页面也不是实际 ChatGPT 环境。

## 1.1.4 新增验证

- 20 项独立回归覆盖用户报告的发送按钮属性、无输入框祖先定位、英文 Send、SVG、直接 pointerenter / mouseenter / focus、语音 / 停止 / 非聊天表单排除、SPA 重新绑定、浮卡宿主显示开关。
- 面板外部 pointerdown / click 关闭；Shadow DOM 内部 / 入口保留；不取消原生事件、不抢外部焦点；设置和密码草稿只保存在内存，重开恢复，设置版本冲突检查仍有效。
- 新增回归复现并修复 Escape 关闭后恢复原生控件焦点重新弹出悬停的问题：焦点恢复后清除悬停计时器。
- `ui-send-smoke.cjs` 使用已报告的完整发送按钮 DOM，提供 Chromium 实际事件 / computed style / SPA / 草稿验证脚本。脚本语法检查通过，但本次环境未能启动 Chromium，所以未把其页面断言标记为通过。
- 当前面板展开也不会压制发送悬停。诊断包含可见发送锚点数量与最近显示检查，仅保留固定样式分类 / 非零尺寸标记，不收集页面内容。
- 源码差异仅涉及版本、界面交互 / 显示 / 诊断；计数与请求观察、WebDAV、持久化键和发布 URL 保持不变。所有原有测试重新通过。

## 1.1.5 新增验证

- 25 项独立模型 / 图片额度回归：当前可见 Pro 才显示；Thinking、Auto、未知和隐藏标签排除；同一输入区和多个输入区隔离；无输入框的有界工具栏；原生控件变更及旧卡收起；请求记账与界面选择解耦。
- 图片额度校验覆盖 0、无效 / 重复 / 缺失字段、不推断无限、严格同源和端点 / 方法范围、拒绝重定向或不符来源的额度响应、原始 Promise / Response、失败 / 过大响应、账号与新初始化竞态、60 秒永久失效、小号行位置和读取时间、跨标签页 / 持久化 / 导出隔离。
- 11 项独立完整网络审查回归：每个页面调用只转发一次，保持 this、参数对象、Promise、Response 和 AbortSignal；random / clock / ledger / save / changed / hash / inspect 或 clone 抛错不阻断原生请求；保留原始同步错误及异步拒绝；取消额度副本不取消或消耗原始响应流。
- 审查发现并修复原观察器初始化助手同步抛错可能阻止 fetch 的边界情况。现在只在 native fetch 前执行受保护的 Request 副本准备；字符串解析和账本 / UI 工作在原调用之后。计数分类、去重与本地账本规则不变。
- 启动、定时器、悬停、诊断和本地 UI 的模拟网络调用数为 0；源码只有一个原 fetch 转发点、一个独立 WebDAV 网络调用点，没有 XHR / WebSocket / beacon / 远程资源注入。既有已授权 WebDAV 的 GET / 条件 PUT / 可选定时同步是明确例外，详见 [网络审查](../SECURITY.md)。
- 旧回归的预期和夹具已按“当前选中 Pro”更新，没有向全局 DOM 夹具添加默认 Pro，从而保留未知模型的失败关闭测试。面板外部收起、草稿与 +1 动效回归全部重跑通过。
- `node --check` 对主脚本与所有 `.cjs` 文件均通过。`ui-send-smoke.cjs` 已添加同区 Pro 选择器；本次普通和经批准的提高权限 Chromium 启动均因 socket 权限退出，没有运行页面断言。

## 1.1.6 新增验证

- 23 项独立回归覆盖本机显示偏好：缺失 / 非法值默认仅 Pro，所有模型模式下的直接 pointerenter / mouseenter / focus、委托 SVG pointerover / focusin、刷新重载、另一标签页重新读取、模型变化、SPA 替换、已显示浮卡切回仅 Pro 立即关闭、存储写入失败保留原选项。
- 确认切换不重建 / 提交周期表单，外部关闭重开保留草稿；不会更改账本 / 记录。导入、导出、备份与 WebDAV v1 数据格式继续排除这个本机界面偏好，旧版远端设置不会覆盖它。
- 合成测试覆盖 310px 宽度与紧凑校准布局、较小且显式的控件字体、完整操作入口、ARIA 选中状态与焦点样式；小于 300px 的视口把初始用量按钮移到第二行。CSS 断言不等于像素视觉验收。
- 原有 194 项测试全部重新通过，总计 217 项、无跳过；新增测试确认切换和悬停不主动联网，实际 Pro 记账仍由请求 / 响应模型决定。
- 与已发布 1.1.5 的源码比较：统计与校准核心、网络观察、图片额度解析 / 生命周期、导入与 WebDAV 算法逐字未改；新增字段只在 UI 启动层读取 / 保存。
- `ui-v116-smoke.cjs` 提供实际浏览器的字号 / 310px 面板 / 56px 校准按钮 / 320px 与 240px 窄屏 / 主题 / 键盘 / 草稿验证流程，已通过语法检查。浏览器阶段未运行成功：`ui-send-smoke.cjs` 在本次 Chromium 启动时仍因 `socket() failed: Operation not permitted` 退出；cloud browser 的 URL 安全策略也拒绝本地 file 页面，未尝试绕过该限制。

## 1.1.7 新增验证

- 9 项独立品牌 / 元信息 / 悬浮卡回归通过；全量 226 项 Node 测试通过，无跳过。主脚本及全部 `.cjs` 语法检查通过。
- 面板可见标题与对话框标签改为 `ChatGPT Toolkit`，保留功能项的 Pro 标记。主面板仍为 310px；项目名采用较小字号与可换行布局。
- 发布元信息继续锁定旧 `@name`、`@namespace`、`gpc.v1.` 和文件名；新下载 / 更新、主页与反馈链接均指向 `YuSaZh/ChatGPT-Toolkit`。README 说明旧标识保留原因和更新原安装的步骤。
- 悬浮卡从 266px 缩为 248px，padding 12×14 → 10×12，数字 30 → 28px，单位 16 → 14px，图片行维持 11px。标题 / 页脚允许换行，长数字可断行，不使用整体缩放或省略号隐藏内容。CSS 声明和合成 DOM 测试不等于真实视觉验收。
- 与 1.1.6 比较：计数、图片额度解析 / 失效、请求观察、WebDAV、存储与导入导出逻辑逐字未改。源码变化限于元信息 / 注释、诊断版本、品牌标题与样式和尺寸回退值。

- `ui-v117-smoke.cjs` 提供品牌标题、248px 悬浮卡、320 / 272 / 240 / 180px 窄屏、100 万上限与超额用量、图片 0 / 大整数 / 过期标签、深色及矮窗口“管理用量”可达性的合成浏览器流程。语法检查通过；本次唯一启动尝试因 Chromium `socket() failed: Operation not permitted` 退出，未进入页面断言，不计为通过。

## 1.1.8 新增验证

- 保留原有 226 项测试；新增 27 项独立 adversarial 审查和 8 项实现侧 UI 回归，共 261 项 Node 测试全通过，无跳过。主脚本与每个 `.cjs` 均通过 `node --check`。
- PoW 覆盖同源 / 路径 / 方法限制，prepare 与旧端点，拒绝 finalize，前导零及大小写保留、真实布尔 required / 未知、缺失 / 非法 / 超大 / 非 JSON / 重定向响应、原 Promise / Response / this / args / AbortSignal、clone 失败 / 取消、异步及同步重入失效竞态；RAM 快照不进入存储、导出或 WebDAV。
- 身份只接受自己的同源 `GET /api/auth/session` 响应的 `user.id`，拒绝其他来源 / 路由 / ID 形态。默认关闭时不克隆身份响应。测试覆盖会话响应倒序、迟到哈希、登出、模式启停、无效身份、可选显示助手失败及原生 fetch 语义；没有读取邮箱 / 令牌作为身份或持久化原始 ID。
- 发送时同步捕获不可变账本上下文。已发出的 A 请求、同步原生重入和后续 B 会话不使请求改记 B；未知请求始终留在随机未分配账本。两份真正启动的合成页面共享同一个 GM store，分别识别 A / B，另一标签页 / 最新共享设置 / WebDAV 的账本选择均不覆盖本页有效账号。
- WebDAV 合并两端记录后、序列化 / PUT 前过滤所有未分配记录；本机旧未分配记录保留、远端未分配记录不导入。合成 GET / 条件 PUT 验证远端 B 的共享设置可合并，但新的本页请求仍归 A；不发送原始 ID / 邮箱 / 令牌或本地开关。
- UI 覆盖默认关闭、无额外查询、等待身份、保留旧历史、散列 ID、记录 / 上限共用说明、显式未分配提示和查看入口、不自动搬移、待识别禁校准、不播放入账 +1、过期校准表单拒绝、失焦 / 导航 / 输入区外交互清空、隐藏页不进入持续重绘循环、工具自身控件不清空身份，以及 PoW 顶部文案与清除。
- 审查发现并修复两个竞态 / 合并边界：PoW / 图片的代次须在原生 fetch 前保留，避免同步重入后旧回包取得新代次；WebDAV 须同时过滤远端已有未分配记录，不能只过滤本机列表。修复后全量重跑通过。
- `ui-v118-smoke.cjs` 提供合成真实浏览器的开关 / 会话 / PoW、180–900px 窄屏、深色主题和无额外流量流程。语法通过；本次唯一 Chromium 启动因 `socket() failed: Operation not permitted` 退出，未运行任何页面断言。没有尝试绕过权限限制，也没有将此阶段计为通过。
- 自动分账明确标为实验功能。没有实测当前网页账号切换信号，故使用保守失效边界；可能长期显示待识别，直到网页自然返回新会话。合成测试只能证明这些已实现的状态边界，不能证明当前真实页面会在需要时提供身份，不能保证即时 / 无缝账号切换。

## 仍未完成 / 历史受阻

- Playwright / Chromium 合成浏览器测试：1.1.8 的 `ui-v118-smoke.cjs`、1.1.7 的 `ui-v117-smoke.cjs` 和此前 1.1.6 / 1.1.5 的启动均受 socket 权限限制，未进入页面断言；1.1.9 本次重跑 `ui-v118-smoke.cjs` 仍在启动阶段受同样限制，详见顶部；没有将未运行的页面断言标为通过。
- 真实 Tampermonkey 扩展注入：未验证。
- 真实 ChatGPT 账号与当前网页交互：未验证；已有用户提供的按钮片段与截图，但外围 DOM、脚本注入及交互结果仍需在用户环境确认。
- 真实 WebDAV 服务：未验证。测试使用模拟响应和明确的假凭据。

没有把合成 DOM 测试当作真实浏览器视觉验收，也没有用真实 Pro 请求消耗额度来测试。

## 本地复现

```sh
node --check chatgpt-pro-counter.user.js
node --test *.test.cjs
```

如机器已安装 Playwright 和 Chromium，可另外运行 `node ui-smoke.cjs`、`node audit-bootstrap.cjs`、`node ui-send-smoke.cjs`、`node ui-v116-smoke.cjs`、`node ui-v117-smoke.cjs`、`node ui-v118-smoke.cjs`。这些脚本默认使用 `/usr/bin/chromium`；不同系统可修改脚本中的浏览器路径。它们仍是合成页面测试，不能替代实际扩展与 ChatGPT 页面验收。

1.1.10 脚本 SHA-256：

```text
7f0a7ff335478729f110474af0d0523206c89db1f5c5dc5ac81e4870491f58b2
```


1.1.11 脚本 SHA-256：

```text
2d8d3d2676457f0fce5e73c036a4d61950094490997682b05c2eb4c8022494fa
```


1.1.12 脚本 SHA-256：

```text
4fdc533e051f370430ab8d1bcdc68a22a4abf21dc07eb56f73ad2b38cb607c21
```


1.1.15 脚本 SHA-256：

```text
d861095df85e41f0522c9637fdbfb05e860fd15324c6447f943641056618133b
```


1.1.16 脚本 SHA-256：

```text
1870da3322d009ed31134ef2ce1668d915ba877d4e95f0873bfffc6fc508cdeb
```

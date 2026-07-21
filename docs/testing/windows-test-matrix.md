# Pi Desktop Windows Test Matrix

测试对象：Pi Desktop `1.0.13`（当前工作区版本）  
测试平台：Windows 10/11，Electron 41.2.0，Node.js >= 22.19.0，pnpm 9。外部依赖：Pi CLI、Git、GitHub 网络、可用的模型 Provider。

## 使用方式

- `P0`：启动、消息收发、会话/工作区、文件安全、审批、终端、设置持久化等阻断性路径。
- `P1`：完整的 Git、计划/任务/记忆、技能/插件、模型配置、更新器和窗口生命周期。
- `P2`：视觉、可访问性、动效、诊断导出、导入/导出和异常恢复的补充路径。
- 执行结果写入 `docs/testing/windows-test-report-2026-07-18.md`，状态使用 `PASS`、`FAIL`、`BLOCKED`、`NOT_RUN`。
- 每条功能至少覆盖正常、空值/边界、非法输入、失败恢复、重复操作和重启/并发中的适用项；高风险文件、Shell、Git 和 IPC 还要覆盖越权路径。

## A. 启动、窗口与系统集成

| ID | P | 用例 | 预期 | 执行 |
|---|---|---|---|---|
| A-001 | P0 | 首次启动主进程 | Electron 启动无未捕获异常，主窗口可见，标题为 Pi Desktop，渲染器非空 | E2E `launch` |
| A-002 | P0 | 已存在用户数据时重启 | 应用恢复可用，不因坏的临时状态阻塞启动 | E2E + 手工 |
| A-003 | P0 | 第二次启动同一实例 | 单实例锁生效，现有窗口被激活，不创建重复主窗口 | 单测 + 手工 |
| A-004 | P0 | 主窗口最小化/恢复 | 窗口状态正确，恢复后内容与会话不丢失 | E2E `window-geometry` |
| A-005 | P0 | 主窗口最大化/还原 | 仅切换一次状态，尺寸/布局不溢出，`is-maximized` 返回一致 | E2E + IPC |
| A-006 | P0 | 主窗口关闭按钮 | 按产品约定隐藏到托盘或退出；无残留子进程和无响应窗口 | E2E `tray-lifecycle` |
| A-007 | P1 | 托盘恢复 | 关闭主窗口后托盘存在，点击恢复主窗口并聚焦 | E2E `tray-lifecycle` |
| A-008 | P1 | 托盘退出 | 退出菜单真正结束 Electron、pty、子窗口和监听器 | 手工/进程检查 |
| A-009 | P1 | 设置窗口独立打开 | 800x600 目标尺寸、独立 BrowserWindow、非模态，可多次打开而不重复创建 | E2E `window-geometry` |
| A-010 | P0 | 设置窗口关闭/再开 | 设置窗口销毁或隐藏符合约定，重新打开仍加载正确 tab | E2E `settings-persistence` |
| A-011 | P1 | 主窗口与设置窗口同时交互 | 两窗口 IPC 不串线，焦点与快捷键作用于正确窗口 | E2E + 手工 |
| A-012 | P1 | Desktop overlay 隐藏/显示 | 主窗口上下文切换后 overlay 锚点、可见性和进度提示正确 | E2E `overlay-anchors` |
| A-013 | P1 | 主窗口关闭时 overlay | 主窗口关闭后不错误展示进度提醒，重新打开后恢复正常 | E2E `overlay-anchors` |
| A-014 | P2 | 窗口拖动区域和 DPI 缩放 | 100%、125%、150% 缩放下标题栏可拖动、按钮可点击、无裁剪 | 手工矩阵 |
| A-015 | P2 | 高对比度/系统深色模式 | 颜色、文字和焦点仍可辨识，不依赖系统主题造成不可读 | 手工 |

## B. 首次启动、Pi 状态与配置

| ID | P | 用例 | 预期 | 执行 |
|---|---|---|---|---|
| B-001 | P0 | 检测 PATH 中已安装 Pi CLI | 状态显示已安装、版本可读，不显示错误 onboarding | E2E `status-onboarding` |
| B-002 | P0 | Pi CLI 缺失 | 显示可行动的安装/配置提示，主 UI 不崩溃 | E2E `status-onboarding` IPC stub + unit `pi-driver-detect` |
| B-003 | P1 | 刷新 Pi 状态 | 状态变化事件只更新一次，旧状态不覆盖新状态 | 单测/IPC |
| B-004 | P1 | 安装 Pi CLI 成功/失败 | 进度、成功结果和失败错误均可见，取消后状态回收 | IPC + 手工 |
| B-005 | P1 | Pi CLI 更新成功/失败 | 版本刷新，失败有可读错误，不破坏当前配置 | IPC + 手工 |
| B-006 | P1 | Pi CLI 卸载 | 卸载成功后状态变为未安装；取消/权限失败可恢复 | IPC + 手工 |
| B-007 | P0 | 首次用户 onboarding | 新用户出现 onboarding；完成、跳过、关闭后的后续启动行为稳定 | E2E `status-onboarding` |
| B-008 | P1 | onboarding 重复打开 | 已完成 onboarding 的用户不会被强制重复引导 | E2E + 重启 |
| B-009 | P0 | 读取 models/auth/settings 配置 | 文件不存在、为空、JSON 损坏、权限不足均返回结构化错误，不抛到 renderer | 单测/IPC |
| B-010 | P0 | 保存配置合法值 | 写入正确文件，保留未修改字段，重新加载结果一致 | E2E `third-party-model` |
| B-011 | P0 | 保存配置非法值 | Zod/业务校验拒绝空 provider、坏 URL、非法模型类型，磁盘不被破坏 | 单测/IPC |
| B-012 | P1 | 原始配置保存 | JSON 文本保存前校验，换行/Unicode/敏感字段处理正确 | IPC + 文件断言 |
| B-013 | P1 | 配置导出 | 导出文件生成，内容完整，路径取消时无异常副作用 | E2E `settings-interactions` |
| B-014 | P1 | 配置导入合法/坏 JSON | 合法导入生效；坏 JSON 有错误且原配置保留 | E2E + IPC |
| B-015 | P1 | fetch models 网络成功/超时/非 2xx | 成功列表正确，超时/网络失败不冻结窗口且给出可重试反馈 | E2E/网络模拟 |
| B-016 | P1 | provider test 成功/鉴权失败/超时 | 结果明确区分成功、鉴权、网络和格式错误 | E2E `settings-interactions` |
| B-017 | P0 | 默认模型设置 | 设置默认模型后聊天选择器、Pi 配置和重启后状态一致 | E2E `settings-pi-config-sync` |
| B-018 | P1 | 外部修改 Pi 配置后重开设置 | 设置摘要和主窗口模型列表刷新，不显示旧缓存 | E2E `settings-pi-config-sync` |
| B-019 | P1 | 受管模型新增/编辑/删除 | 表单校验、保存、取消、删除确认和删除后列表更新正确 | E2E `settings-interactions` |
| B-020 | P1 | Anthropic/API key 等 provider 字段 | 输入显示、保存、读取和错误反馈符合 provider 规则，敏感值不出现在日志 | E2E + 日志审计 |
| B-021 | P2 | 配置文件并发写入 | 两次保存串行化，最终 JSON 不被截断/交叉覆盖 | 集成/并发 |
| B-022 | P1 | 主题、语言、通知、侧栏/右栏设置 | 立即生效，重新打开和重启仍保持，所有主面板同步 | E2E `notification-settings`/`visual-audit` |
| B-023 | P2 | 快捷键录制/取消/单项重置/全部重置 | 冲突、空快捷键、Escape 取消均可处理，默认值可恢复 | E2E `settings-interactions` |

## C. 工作区与会话中心

| ID | P | 用例 | 预期 | 执行 |
|---|---|---|---|---|
| C-001 | P0 | 创建工作区 | 目录选择后创建/注册 workspace，切换到该工作区且路径正确 | E2E `core-workflow` |
| C-002 | P0 | 空目录工作区 | 空目录可进入，显示空态，不要求已有 Git/项目文件 | E2E `m2-workspace-routing` |
| C-003 | P0 | 非目录路径/无权限目录 | 拒绝并提示，当前工作区保持不变 | IPC + 手工 |
| C-004 | P0 | 工作区切换 | 当前 workspace、会话、终端、Git 和模型上下文全部切换 | E2E `continuous-workspace-persistence` |
| C-005 | P1 | 删除工作区 | 删除注册关系不误删用户目录；当前工作区有安全的回退 | E2E + 文件断言 |
| C-006 | P1 | 工作区重复添加/大小写路径 | 去重和路径规范化一致，Windows 大小写/尾斜杠不产生重复项 | 单测/IPC |
| C-007 | P1 | 工作区检测项目类型 | Git、Node、Python、Go 等探测结果准确；未知目录仍可打开 | 单测 `project-detector` |
| C-008 | P0 | 新建会话 | 新会话获得唯一 ID，绑定当前 workspace/agent，输入区清空 | E2E `chat-view` |
| C-009 | P0 | 会话列表/摘要 | 列表按预期分组、排序，标题/时间/消息数量正确 | E2E `session-history` |
| C-010 | P0 | 会话打开/历史跳转 | 从列表、搜索、命令面板打开目标会话，消息和滚动定位正确 | E2E `session-history` |
| C-011 | P0 | 会话持久化重启 | 消息、usage、工具调用、卡片和 agent 绑定重启后仍可恢复 | E2E `session-resume`/`session-bound-agent-persistence` |
| C-012 | P1 | 会话搜索空/大小写/中文/特殊字符 | 搜索结果准确；无结果空态；不因正则字符崩溃 | E2E + 单测 |
| C-013 | P1 | 会话归档/恢复 | 归档项从主列表移入 archived，恢复回原分组 | E2E `session-history` |
| C-014 | P0 | 删除会话及取消确认 | 取消不删除；确认只删除目标会话，当前会话有安全回退 | E2E `session-history` |
| C-015 | P1 | 会话元数据编辑 | 标题、置顶、标签等合法修改持久化；空标题使用规则化回退 | IPC/UI |
| C-016 | P1 | 日期分组 | 今天/昨天/本周/本月/更早边界按本地时区正确归组，跨午夜稳定 | 单测 + 手工 |
| C-017 | P1 | 工作区分组 | workspace 分组可折叠，跨工作区会话不串组 | E2E `m2-workspace-routing` |
| C-018 | P1 | 会话树结构/分叉 | parent_id、分支/恢复消息加载正确，删除父节点不破坏可读历史 | SQLite 集成 |
| C-019 | P1 | 旧 electron-store 数据迁移 | 旧格式可读取/迁移，重复迁移幂等，损坏记录隔离 | 单测/迁移 |
| C-020 | P2 | 批量导出 | 选中、多选、全选、无选、目标路径取消、超大文本和 Unicode 均正确 | E2E `m5-search-io-export` |
| C-021 | P2 | Claude/Codex 会话导入 | 扫描、导入、重复、格式坏、路径越权、取消选择均有明确结果 | IPC/fixture |

## D. 聊天、Pi Agent、模式与流式运行

| ID | P | 用例 | 预期 | 执行 |
|---|---|---|---|---|
| D-001 | P0 | 发送普通文本 | 用户消息立即出现，Pi 流式事件逐步渲染，完成后状态收敛 | E2E `chat-view` |
| D-002 | P0 | 空白/超长/多行消息 | 空白不提交；多行按预期；超长有界面或后端保护，不冻结 | 单测 ChatInput blank/multiline |
| D-003 | P0 | Enter/Shift+Enter | Enter 提交，Shift+Enter 换行，Windows IME/组合输入不误提交 | 单测 useInputShortcuts；IME residual |
| D-004 | P0 | 发送中清空草稿 | 提交立即清空输入框，后台请求继续且不丢消息 | E2E `draft-clear` |
| D-005 | P0 | 流式 text_delta + turn_end 并发 | 消息顺序、最终文本和 loading 状态稳定，无重复/截断 | 单测/集成 |
| D-006 | P0 | provider message_end 错误 | 错误在聊天中可见且可操作，不被泛化为空响应 | E2E `chat-view` |
| D-007 | P0 | 网络断开/Provider 超时 | 当前消息状态可恢复，重试或新消息可用，窗口不死锁 | E2E `provider-error` |
| D-008 | P0 | 停止生成 | abort 只影响目标 workspace/session，状态、输入框、历史正确 | E2E `running-control` |
| D-009 | P1 | 多工作区并发会话 | 消息和事件按 workspace 路由，互不串流 | E2E `core-workflow` |
| D-010 | P1 | 多 agent 创建/切换/隔离 | agent 列表、消息、权限、thinking 设置互不污染 | E2E `core-workflow` |
| D-011 | P1 | agent restart/stop/abort | 每种终止语义正确，重复调用幂等，运行态回收 | IPC/集成 |
| D-012 | P1 | thinking level 切换 | 可选值生效，事件/显示一致，非法值拒绝 | IPC/单测 |
| D-013 | P1 | 模式切换 chat/plan/compose/build | 模式状态、工具集、输入提示和请求上下文同步，不泄漏内部包装文本 | E2E `deep-use-agent-mode-runtime` |
| D-014 | P0 | Plan 模式单次提交 | 仅发送一次 `/plan`，计划卡出现后选择区可用 | E2E `plan-mode-smoke` |
| D-015 | P1 | Plan 批准/拒绝/修改/取消 | 每个 decision 只消费一次，错误 decision 不改变计划 | IPC/E2E |
| D-016 | P1 | Plan 工具限制 | plan 模式移除 mutation 工具，保留 read/plan_write，always 权限不能覆盖 | E2E `permission-enforcement` |
| D-017 | P1 | Compose workflow | workflow 状态、子 agent、artifact 路径、回退模式和失败重试正确 | E2E `compose-workflow-runtime` |
| D-018 | P1 | Slash 命令列表 | 内置、技能、扩展命令去重、排序、搜索正确；不支持命令明确隐藏/报错 | E2E `deep-use-slash-surface-audit` |
| D-019 | P1 | Slash 命令参数 | 参数缺失、空格、引号、Unicode 和超长输入正确传递 | 单测/E2E |
| D-020 | P1 | 内置命令 reload/new/session 等 | 每个命令只触发目标动作，失败返回结构化结果 | IPC/E2E |
| D-021 | P1 | Mention/file reference | 路径解析、空格、中文、点文件、越工作区路径均正确处理并在发送前展示 | E2E `command-palette-callbacks` |
| D-022 | P1 | Attachment | 添加、删除、重复、不可读文件和计划模式上下文正确 | E2E `plan-mode-current-ui` |
| D-023 | P1 | Markdown/GFM/code block | 表格、代码、链接、长行、HTML/raw 策略渲染正确且不执行脚本 | 单测/E2E/a11y |
| D-024 | P1 | thinking block 合并 | 相邻 thinking block 合并，计数准确，流式更新不跳动 | E2E `plan-mode-current-ui` |
| D-025 | P1 | 生成 UI 卡片 | 历史卡片、运行时卡片、未知 action、白名单 action、重放和共存均安全 | E2E `generated-ui-v1-acceptance` |
| D-026 | P2 | Token/usage 统计 | 当前会话、header、settings 统计一致；空值/大数/跨重启正确 | E2E `main-token-stats` |
| D-027 | P2 | 通知 | 完成/错误/后台运行通知遵循开关，关闭通知不发送；重启保持 | E2E `notification-settings` |
| D-028 | P1 | 全局快捷键/命令面板 | Ctrl+K 打开，Escape 关闭，cmd/file/history 模式切换和 callback 正确 | E2E `command-palette-callbacks` |

## E. 审批、权限、安全与人工确认

| ID | P | 用例 | 预期 | 执行 |
|---|---|---|---|---|
| E-001 | P0 | high-risk tool call | 工具执行前出现审批请求，磁盘无提前修改 | E2E `permission-enforcement` |
| E-002 | P0 | approve once | 仅当前请求放行，执行结果/文件 review 可见 | E2E |
| E-003 | P0 | deny | 工具不执行，agent 收到拒绝结果，会话仍可继续 | E2E |
| E-004 | P0 | approval 超时/窗口关闭 | 请求回收为拒绝或可恢复状态，不挂起 agent | 单测/手工 |
| E-005 | P1 | auto-approve 开关 | 开关事件同步主进程；关闭后立即恢复审批 | IPC/E2E |
| E-006 | P1 | permission mode 切换 | read/edit/high-risk/always 等模式只影响允许范围，持久化规则正确 | E2E `permission-more-menu` |
| E-007 | P0 | write disabled guard | 写操作在触盘前被拦截，文件内容与 mtime 不变 | E2E `permission-enforcement` |
| E-008 | P1 | deferred edit review | 延迟编辑可查看、逐项/全部应用、取消和重复应用幂等 | 单测/E2E |
| E-009 | P1 | protected paths | `.git`、配置、数据库、工作区外路径和系统路径不能被越权编辑/删除 | 单测/IPC |
| E-010 | P0 | IPC 参数注入 | 所有高风险 IPC 对类型、空串、超长、相对路径、UNC 路径、`..` 做校验 | schema 单测 |
| E-011 | P1 | Shell command risk classifier | normal/read/edit/high-risk 分类覆盖引号、管道、&&、大小写和危险 Git 变体 | shared 单测 |
| E-012 | P1 | renderer API 暴露面 | preload 仅暴露 typed API，不暴露 Node/Electron 原始对象，事件取消订阅有效 | preload 单测 |
| E-013 | P1 | CSP/XSS | markdown、文件名、错误文本、provider 返回内容中的脚本不执行 | E2E/a11y/security |
| E-014 | P2 | 日志脱敏 | API key、token、密码、路径敏感片段不落日志和诊断导出 | 单测/日志审计 |

## F. 文件、搜索、编辑器与 Workbench

| ID | P | 用例 | 预期 | 执行 |
|---|---|---|---|---|
| F-001 | P0 | 文件树扫描 | 目录、文件、空目录、深层目录、排序和展开正确 | 单测/E2E |
| F-002 | P1 | 文件树过滤 | `.git`、node_modules 等按规则隐藏；点文件在需要的搜索路径可见 | E2E `m5-search-io-export` |
| F-003 | P0 | 读取文本文件 | UTF-8、BOM、中文、CRLF、空文件和大文件正确；二进制不误当文本 | IPC/fixture |
| F-004 | P0 | 工作区外读取 | 拒绝绝对越权、`..`、符号链接绕过和 UNC 路径 | IPC/security |
| F-005 | P0 | 写入文本文件 | 新建、覆盖、目录不存在、权限失败、Unicode 和换行正确 | IPC/E2E |
| F-006 | P0 | expectedMtime 冲突 | 文件被外部修改时拒绝覆盖并提示冲突，原文件保留 | IPC/集成 |
| F-007 | P1 | 文件搜索 | 大小写、中文、空查询、特殊字符、点文件、limit 边界和取消正确 | E2E `m5-search-io-export` |
| F-008 | P1 | 文件选择/打开/reveal | 取消选择无副作用，目标路径受保护，系统打开失败可恢复 | IPC/UI |
| F-009 | P1 | Monaco 编辑器 | 打开、修改、保存、撤销/重做、只读、语法高亮和长文本不崩溃 | 单测/E2E |
| F-010 | P1 | Workbench 二级 tabs | files/git/terminal 切换保持上下文，面板高度和折叠状态正确 | E2E `layout-panels` |
| F-011 | P1 | active file | 选择文件后右栏/编辑器/聊天引用同步，切换 workspace 不串文件 | IPC/E2E |
| F-012 | P2 | 搜索历史 | 保存、删除、清空、重复查询去重和重启保持正确 | E2E/单测 |

## G. Git 工作流

| ID | P | 用例 | 预期 | 执行 |
|---|---|---|---|---|
| G-001 | P0 | 非 Git 目录 status | 返回明确的非 Git 状态，Git panel 不崩溃 | E2E `file-and-git` |
| G-002 | P0 | clean/modified/untracked status | 分支、改动、未跟踪、删除和冲突状态准确 | E2E `file-and-git` |
| G-003 | P1 | diff unstaged/staged | diff 文本、文件列表、空 diff 和二进制提示正确 | E2E `right-rail-git-workflow` |
| G-004 | P1 | stage/unstage 单个/多个/空列表 | 状态正确更新，空列表为 no-op，不误改其他文件 | IPC/E2E |
| G-005 | P0 | commit 合法 message | commit 成功，日志和状态刷新 | E2E `file-and-git` |
| G-006 | P0 | commit 空/空白/超长/特殊 message | 拒绝空值，特殊字符不被 shell 注入，错误可见 | schema/IPC |
| G-007 | P1 | branch 列表/切换 | 当前分支、远端分支、无分支、非法分支名和工作区 dirty 状态正确 | E2E `right-rail-git-workflow` |
| G-008 | P1 | 创建分支 | 合法名成功，重复/非法/空名拒绝，不污染当前工作区 | IPC/E2E |
| G-009 | P1 | push 成功/无远端/鉴权失败/冲突 | 结果可理解，不吞错误，不进入假成功状态 | E2E + mock |
| G-010 | P1 | original content | tracked、untracked、删除文件和路径越权结果正确 | IPC |
| G-011 | P0 | git undo tracked | 恢复 HEAD 内容，受保护路径和非目标文件不变 | E2E/IPC |
| G-012 | P0 | git undo untracked/modified | 按安全策略拒绝或仅删除允许的 untracked，提示准确 | 单测/IPC |
| G-013 | P1 | 并发 Git 读取 | status/diff/log 重复读取去重，结果不会互相覆盖 | 单测/集成 |

## H. Terminal 与工具调用

| ID | P | 用例 | 预期 | 执行 |
|---|---|---|---|---|
| H-001 | P0 | 创建终端 | 返回唯一 terminal id，cwd/workspace 绑定正确，输出可订阅 | E2E `terminal-and-tools` |
| H-002 | P0 | 输入命令/输出 | 输入、回显、ANSI、中文、换行和长输出正确 | E2E terminal-and-tools + unit terminal.ipc ANSI/中文 |
| H-003 | P1 | resize | cols/rows 边界校验，终端布局同步，不丢输出 | IPC/E2E |
| H-004 | P0 | 终端退出 | exit code 正确，订阅回调只触发一次，关闭后输入被拒绝 | 单测/E2E |
| H-005 | P1 | 多终端 tabs | 每个终端隔离，切换不串输出，关闭单个不影响其他 | E2E |
| H-006 | P0 | 危险 Shell 命令审批 | 命令执行前触发高风险确认，拒绝时不改文件 | E2E/分类器 |
| H-007 | P1 | 工具调用卡片 | read/edit/execute 状态、参数、结果、错误和重试显示正确 | E2E |
| H-008 | P1 | 工具长运行/取消 | 取消停止底层执行并更新 UI，重复取消幂等 | 集成 |

## I. 计划、任务、记忆与长周期运行

| ID | P | 用例 | 预期 | 执行 |
|---|---|---|---|---|
| I-001 | P1 | plan create/list/get | 合法数据可创建、查询、列表排序，缺失 workspace 被拒绝 | 单测/IPC |
| I-002 | P1 | plan update | 仅允许合法状态/字段修改，版本或并发冲突可识别 | 单测/集成 |
| I-003 | P1 | plan complete/delete | 完成与删除状态持久化，重复操作幂等，当前 plan 回收 | IPC/E2E |
| I-004 | P1 | task create/rename | 标题边界、重复 ID、非法输入处理正确 | 单测/IPC |
| I-005 | P1 | task start/block/unblock | 状态迁移符合状态机，非法迁移拒绝，时间戳/进度一致 | 单测/集成 |
| I-006 | P1 | task done/abandon | 终态不可误恢复，UI 和持久化一致 | IPC/E2E |
| I-007 | P1 | task list/get active | workspace/agent 过滤正确，空结果安全 | IPC/E2E |
| I-008 | P1 | memory write/index | Markdown 记忆写入、索引更新、重复记录和坏文件处理正确 | 单测 |
| I-009 | P1 | memory search | 空 query、中文、大小写、limit、无结果和损坏索引正确 | 单测/E2E |
| I-010 | P1 | memory recent | 时间排序、limit 边界、跨 workspace 隔离正确 | 单测/E2E |
| I-011 | P1 | memory path guard/reconcile | 工作区外路径、删除/重命名文件、索引重建安全且幂等 | 单测 |
| I-012 | P2 | long-horizon checkpoint/judge | checkpoint 恢复、judge 成功/失败/超时、重启续跑和重复评估正确 | 单测/E2E |
| I-013 | P1 | subagent list/cancel | 类型/实例列表隔离，取消未知/已终止实例返回安全结果 | IPC/E2E |
| I-014 | P1 | agent runtime registry | create/prompt/stop/restart/suppress 多次调用不泄漏实例 | 单测 |

## J. 技能、插件、Pi packages 与生成式 UI

| ID | P | 用例 | 预期 | 执行 |
|---|---|---|---|---|
| J-001 | P1 | 本地技能列表 | 无目录、空目录、坏 frontmatter、workspace 覆盖和重复 slug 均可处理 | IPC/E2E |
| J-002 | P1 | skills marketplace search | 空 query、中文、网络失败和分页/空结果正确 | E2E `skills-and-plugins` |
| J-003 | P1 | skill install/uninstall | 成功、已安装、版本冲突、网络失败和回滚正确 | E2E + 文件断言 |
| J-004 | P1 | skill toggle | enabled 状态持久化，聊天命令列表实时更新 | E2E |
| J-005 | P1 | GitHub import | 合法 URL、非 GitHub、私有/不存在仓库、路径注入和网络失败安全 | IPC/security |
| J-006 | P1 | write skill | 名称/内容校验，路径固定在技能目录，覆盖确认和 Unicode 正确 | IPC/E2E |
| J-007 | P1 | Pi package catalog | 搜索、刷新、空/坏 catalog 和缓存回退正确 | E2E `skills-and-plugins` |
| J-008 | P1 | package install/update/remove | 按钮状态、进度、失败回滚、重复点击和重启后列表正确 | E2E |
| J-009 | P2 | extension UI bridge | prompt/confirm/select/notify 等请求路由到正确窗口，取消和坏请求安全 | 单测/E2E |
| J-010 | P2 | generated UI whitelist | 只允许白名单组件/action，未知组件不执行脚本且保留可读 fallback | E2E `generated-ui-v1-acceptance` |

## K. 更新、诊断、国际化、无障碍和非功能

| ID | P | 用例 | 预期 | 执行 |
|---|---|---|---|---|
| K-001 | P1 | updater get state | 未启用、无网络、已是最新、发现更新的状态明确 | 单测/E2E |
| K-002 | P1 | updater check | 不阻塞主窗口，事件状态单调推进，重复 check 幂等 | E2E `updater` |
| K-003 | P1 | updater download | 进度/失败/取消/磁盘不足可见，下载不破坏当前版本 | E2E + mock |
| K-004 | P1 | updater install | 仅有可安装更新时允许，重启后安装流程完整，异常可回退 | 手工/打包环境 |
| K-005 | P1 | diagnostics export | 生成可读报告，包含必要运行信息但脱敏 token/key，路径取消安全 | IPC/E2E |
| K-006 | P0 | typed IPC error contract | 所有 handler 的失败均为结构化 `IpcError` 或明确结果，不出现未捕获 rejection | 单测/日志 |
| K-007 | P1 | 事件订阅/取消订阅 | renderer 销毁后无回调泄漏；同一事件不重复订阅 | 单测 |
| K-008 | P1 | zh-CN/en-US 切换 | 主要 UI、错误、空态、设置和动态文本均有翻译，不出现 key 泄漏 | E2E/截图 |
| K-009 | P2 | axe critical/serious | 主聊天页和命令面板无 critical/serious violation，键盘焦点可见 | E2E `a11y` |
| K-010 | P2 | 键盘导航 | Tab 顺序合理，Enter/Space 操作控件，Escape 关闭 modal/popover | 手工/E2E |
| K-011 | P2 | 视觉布局 | 主导航、左右栏、设置 tabs、终端、Git、空态和 loading 无重叠/裁剪 | E2E `visual-audit` |
| K-012 | P2 | 100/125/150/200% DPI | 文字、按钮、面板和窗口尺寸稳定，无横向溢出 | 手工截图矩阵 |
| K-013 | P2 | 性能基线 | 冷启动、首屏、长会话、长输出、大文件搜索和多终端不出现明显卡死/内存持续增长 | 手工/性能记录 |
| K-014 | P1 | 打包安装 | NSIS 安装、卸载、快捷方式、用户数据保留策略和首次启动正确 | `package` + 手工 |
| K-015 | P1 | 升级安装 | 旧版本升级后配置/会话保留，版本号、卸载和回滚策略正确 | 打包矩阵 |
| K-016 | P0 | 崩溃/异常恢复 | renderer/main/pty 异常有日志，重启后用户数据不损坏，会话可恢复 | E2E session-resume 重启后 shell+listSessions；强制 crash residual |

## 覆盖要求

1. P0 全部执行通过后才允许给出“核心功能通过”。
2. 每个 IPC handler 至少有一个成功用例、一个非法输入/错误用例；文件、Git、终端、审批还必须有工作区外/危险路径用例。
3. 真实 Provider、GitHub、Pi CLI、Windows 托盘、NSIS 安装和自动更新属于环境相关测试，无法在无凭据/无发布包时标记为 PASS，只能标记 `BLOCKED` 并记录原因。
4. 对失败项记录：ID、实际结果、复现步骤、日志/截图、严重等级、是否回归验证。

## 2026-07-21 执行映射（逐 ID 见 qa-progress，非 174 全绿）

证据源：`docs/testing/qa-progress-2026-07-21.md`（含 **174 行逐 ID 表**）。

- **wave-6 全量 suite（权威）**：`/tmp/e2e-full-wave6-20260721-040535.log` — **116 passed / 1 failed / 6 skipped / 28.7m**（`e2e:build`）。
- **wave-6 残差**：`command-palette-callbacks` **7/7 PASS**（修闭 full-suite 唯一 fail：终端 CTA strict-mode）。
- **wave-7 live**：deep-interactive **5/5 PASS**（minimax）；long-horizon 初版 settings+Build 绿、Plan hang。
- **wave-8 long-horizon**：`RUN_LONG_HORIZON_ACCEPTANCE=1` → **1 passed / 52.9s**（`/tmp/e2e-live-i012-wave8g-20260721-062942.log`）；当时 plan_probe **seed** → 曾 PARTIAL。
- **wave-9b long-horizon**：`RUN_LONG_HORIZON_ACCEPTANCE=1` → **1 passed / 35.0s**（`/tmp/e2e-live-i012-wave9b-20260721-065806.log`）；**plan source=model**；**plan_probe 模型写出 PLAN_OK（no seed）** + BUILD_SWITCH plan→build → I-012 **PASS**（`/tmp/live-i012-wave9b-evidence.txt`）。
- **wave-58 residual**：VirtualizedMessageList **3** + GeneratedUiChart pure/UI **4**（`buildChartOption`）；NSIS still **BLOCKED**（`/tmp/wave58-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-57 residual**：NSIS re-probe still **BLOCKED**；UX PiConfigEditor/ShortcutsSettings a11y；unit **6**（`/tmp/wave57-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-56 residual**：DiffViewer `splitHunkLines` pure/UI **6**；FoldRow keyboard a11y；NSIS still **BLOCKED**（`/tmp/wave56-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-55 residual**：ProjectGroupedSessionList UX + unit **3**；session-grouping depth/activity/group expand；cluster w/ wave-54 **11**；NSIS still **BLOCKED**（`/tmp/wave55-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-54 residual**：DateGroupedSessionList pure/UI **4**（injectable `now` + local-calendar）；group focus-visible；NSIS still **BLOCKED**（`/tmp/wave54-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-53 residual**：GeneratedUiForm pure/UI **4** + MiniMaxCodeTitleBar **2**；NSIS still **BLOCKED**（`/tmp/wave53-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-52 residual**：GeneratedUiTable pure/UI **4** + SessionExport recheck **3**；NSIS still **BLOCKED**（`/tmp/wave52-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-51 residual**：NSIS re-probe still **BLOCKED**；UX SessionExportDialog a11y；unit ModelSelector/MotionPanelLayer/CustomMessageCard/SessionExport **10**（`/tmp/wave51-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-50 residual**：UX ShortcutsCheatsheet close a11y；unit ShortcutsCheatsheet/SessionRow **6**；NSIS still **BLOCKED**（`/tmp/wave50-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-49 residual**：unit SettingsNav **3** + Popover **3**（**6**）；NSIS still **BLOCKED**（`/tmp/wave49-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-48 residual**：unit session-path **3** + AnimatedCollapse **3**（**6**）；NSIS still **BLOCKED**（`/tmp/wave48-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-47 residual**：UX Button/ErrorBoundary/ThinkingBlock a11y；unit **9**；NSIS still **BLOCKED**（`/tmp/wave47-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-46 residual**：unit theme **7** + directives-pure **6** + judge-prompt **4**（**17**）；NSIS still **BLOCKED**（`/tmp/wave46-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-45 residual**：unit ApprovalPanel **3** + LongHorizonTab **3**；UX ApprovalPanel bulk focus-visible；NSIS still **BLOCKED**（`/tmp/wave45-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-44 residual**：export TaskOverviewPanel pure mappers；UX ChangeApprovalCard a11y；unit pure/ChangeApprovalCard **8**；NSIS still **BLOCKED**（`/tmp/wave44-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-43 residual**：unit MemoryPanel **3**；NSIS still **BLOCKED**（`/tmp/wave43-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-42 residual**：UX Settings ModelSelector button a11y；unit ModelSelector/Appearance/Permissions **5**；NSIS still **BLOCKED**（`/tmp/wave42-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-41 residual**：UX SkillCreateDropdown menu a11y；unit **2**；NSIS re-probe still **BLOCKED**（`/tmp/wave41-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-40 residual**：unit TopTabBar **2** + UsageStatsPanel **1**；NSIS still **BLOCKED**（`/tmp/wave40-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-39 residual**：UX FileChangeItem a11y + RecentWorkspaces formatTimeAgo；unit FileChangeItem/RecentWorkspaces **6**（cluster 13 w/ wave-38）；NSIS still **BLOCKED**（`/tmp/wave39-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-38 residual**：UX ResizablePanel a11y + SkillCard focus；unit ResizablePanel/RunPanel/SkillCard **7**；NSIS still **BLOCKED**（`/tmp/wave38-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-37 residual**：shared-types ipc-guards **4**（isSettingsWindowTab + ipcError）；suite **47**；NSIS still **BLOCKED**（`/tmp/wave37-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-36 residual**：unit list-local-skills **4** + desktop-overlay **1** + pi-api **2** + claude/codex sessions **2**（**9**）；nsis honesty **4/4**；security/memory refresh；NSIS re-probe still **BLOCKED**（`/tmp/wave36-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-35 residual**：unit helpers **7** + packages.ipc **6** + usePlanSyncEffect pure **5** + settings-nav-metadata **4**（**22**）；export plan-sync pure helpers；NSIS re-probe still **BLOCKED**（`/tmp/wave35-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-34 residual**：unit useShortcuts **4** + contentWithGeneratedUiText；NSIS re-probe still **BLOCKED**（`/tmp/wave34-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-33 residual**：unit usePrefillConsumer/useInputText/useRenderedPlanCardIds **8**；NSIS re-probe still **BLOCKED**（`/tmp/wave33-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-32 residual**：unit useLatestRequest/useTransientState/useDebouncedSave **9**；NSIS re-probe still **BLOCKED**（`/tmp/wave32-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-31 residual**：unit session-summary-tools + asset-inventory-tools **8** （cluster 19 w/ spawn-handler）；nsis honesty **4/4**；NSIS still **BLOCKED**（`/tmp/wave31-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-30 residual**：unit spawn-handler **11**；NSIS re-probe still **BLOCKED**（`/tmp/wave30-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-29 residual**：unit permission defaults + engine regression **23**；NSIS still **BLOCKED**（`/tmp/wave29-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-28 residual**：live 门控 E2E deep-interactive **5/5** + long-horizon-live **1/1** （host minimax）；NSIS re-probe still **BLOCKED**（`/tmp/wave28-evidence.txt`）— **≠ 装机 PASS / ≠ 174 全绿**。
- **wave-27 residual**：E2E **4/4** continuous-acceptance.generated + nsis honesty；NSIS still **BLOCKED**（`/tmp/wave27-evidence.txt`）— **≠ 装机 PASS**。
- **wave-26 residual**：unit permission/evaluate/wildcard/tool-category + mutation-queue + IpcError + tab-defs + diff-parser **29**；`parseDiff` `/dev/null` isNew fix；E2E **6/6** full-demo/interactive-demo/nsis-artifact-inventory + nsis honesty；NSIS still **BLOCKED**（`/tmp/wave26-evidence.txt`）— **≠ 装机 PASS**。
- **wave-25 residual**：E2E **16/16** session-bound-agent/settings-pi-config/terminal-tools/tray/updater + nsis honesty；NSIS still **BLOCKED**（`/tmp/wave25-evidence.txt`）— **≠ 装机 PASS**。
- **wave-24 residual**：E2E **27/27** permission-more/plan-mode-current-ui/session-*/settings-interactions/window-geometry + nsis honesty；NSIS still **BLOCKED**（`/tmp/wave24-evidence.txt`）— **≠ 装机 PASS**。
- **wave-23 residual**：unit sdk-runtime **4**；E2E **26/26** a11y/chat-view/command-palette/file-git/notification/permission + nsis honesty；NSIS re-probe still **BLOCKED**（`/tmp/wave23-evidence.txt`）— **≠ 装机 PASS**。
- **wave-22 residual**：unit file-workspace-utils **12** + tool-call-normalization **5**（17）；E2E **18/18** smoke/draft-clear/overlay/running-control/plan-mode/status-onboarding + nsis honesty；NSIS re-probe still **BLOCKED**（`/tmp/wave22-evidence.txt`）— **≠ 装机 PASS**。
- **wave-21 residual**：unit useMentions **5**（hooks cluster 12）；E2E **10/10** deep-use/continuous-f06-f10/provider-error + nsis honesty；NSIS re-probe still **BLOCKED**（`/tmp/wave21-evidence.txt`）— **≠ 装机 PASS**。
- **wave-20 residual**：unit **7**（useCommandPalette/useSession）；E2E **12/12** compose/m5/m6/programmer/settings-v2/third-party-model + nsis honesty；NSIS re-probe still **BLOCKED**（`/tmp/wave20-evidence.txt`）— **≠ 装机 PASS**。
- **wave-19 residual**：unit **14**（ipc/sounds/focus-trap/motion-presence）；E2E **12/12** core/continuous/git/token/generated-ui + nsis honesty；NSIS re-probe still **BLOCKED**（`/tmp/wave19-evidence.txt`）— **≠ 装机 PASS**。
- **wave-18 residual**：unit **26**（path-canonical + attachments/permission/skills store）；E2E **16/16** launch/layout/motion/m2/visual/settings/skills + nsis honesty；NSIS re-probe still **BLOCKED**（`/tmp/wave18-evidence.txt`）— **≠ 装机 PASS**。
- **wave-17 residual**：unit **45**（fuzzy/run-control/runtime-feature/first-launch/toast 等）；E2E **12/12** session + nsis honesty；NSIS re-probe still **BLOCKED**（`/tmp/wave17-evidence.txt`）— **≠ 装机 PASS**。
- **wave-16 residual**：`plan-utils` **16** + `useInputShortcuts` **9** + plan-execution **5** unit；E2E **9/9**（draft/nsis/plan/running）；security/window unit **108**；typecheck PASS；NSIS re-probe still **BLOCKED**（`/tmp/nsis-probe-wave16.txt`）— **≠ 装机 PASS**。
- **wave-10/12 NSIS 隔离**：无 Sandbox/admin/Docker + 主机已装 1.0.13 → K-004/K-014/K-015 **BLOCKED**（`/tmp/nsis-isolation-gate-wave12.txt`）；`e2e/nsis-isolation-gate.spec.ts` **3/3**（ready-pack + probe + host refuse）；就绪包：smoke + wsb + runbook — **仍 ≠ 装机 PASS**。
- 历史 postfix：`%TEMP%/e2e-full-postfix.log`（**100 / 5 / 2 / 6**）已 superseded，仅作时间线。

### 汇总

| Status | 数量 | 含义 |
|---|---:|---|
| PASS | 100 | 本波 Electron E2E / 定点契约直接证据 |
| UNIT_PASS | 71 | 单测/IPC smoke 主路径 |
| PARTIAL | 0 | — |
| BLOCKED | 3 | NSIS 装机隔离（K-004/K-014/K-015） |
| NOT_RUN | 0 | — |
| **合计** | **174** | **≠ 全绿**（3 BLOCKED） |

P0（55）：PASS 38 / UNIT_PASS 17 / PARTIAL 0 / BLOCKED 0（自动化 ID 闭环；非场景穷尽）。  
P1（101）：PASS 50 / UNIT_PASS 48 / PARTIAL 0 / BLOCKED 3。  
P2（18）：PASS 12 / UNIT_PASS 6 / PARTIAL 0 / BLOCKED 0 / NOT_RUN 0。

### 块级摘要

| 映射范围 | 代表 ID | 证据 | 状态口径 |
|---|---|---|---|
| 窗口/主题/设置再开 | A-009/A-010/A-011/B-017/B-018/B-022/K-011 | `visual-audit`、`settings-pi-config-sync` | 自动化 **PASS**；A-014 multi-scale force-dpr **PASS** |
| 工作区/会话/搜索 | C-001–C-014 核心 P0 | `session-history`、`m2`、`m5`、`deep-use` | 核心 **PASS**；C-003 越权 **UNIT_PASS** |
| 程序员主路径/M6 | D/E + 审批/设置/导出 | `m6-final`、`programmer-workflow` | **PASS**（dual-path stub 凭证） |
| 文件/终端/Git | F/G/H | `terminal-and-tools`、`file-and-git`、`right-rail-git`、`command-palette-callbacks` residual | 契约 **PASS**；F-009/H-005 **UNIT_PASS**；G-008/G-009 **UNIT_PASS**；palette→终端 **PASS** |
| 长程/记忆/任务 | I | `deep-use`、memory unit、compose、**live deep-interactive 5/5**、long-horizon wave9b | 链路 **PASS/UNIT**；I-012 **PASS**（模型写 plan_probe + BUILD_SWITCH） |
| generated UI / skills | J | `generated-ui`、`skills-and-plugins` | J-010 **PASS**；marketplace 网络 unit 边界 |
| overlay / a11y / visual | A-012/A-013/K-009/K-011 | `overlay-anchors`、`a11y`、`visual-audit` | **PASS**；A-015 theme unit **UNIT_PASS** |
| 安全 IPC | E-009–E-012/K-006 | protected-paths / classifier / schemas / smoke | **UNIT_PASS** 刷新绿 |
| 安装升级 / live provider | K-004/K-014/K-015、I-012 | NSIS inventory + isolation gate deny；live deep 5/5 + long-horizon wave9b | NSIS **BLOCKED**；I-012 **PASS** |
| DPI / perf / tray quit | A-008/A-014/K-012/K-013 | force-dpr matrix + k013 JSON + quit child windows | **PASS** |

**禁止**把 suite **116** passed、100 PASS、deep 5/5 live 或 171 PASS+UNIT 解读为矩阵 174 全部 PASS。
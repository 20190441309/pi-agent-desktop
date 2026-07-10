# Pi Desktop Design System

## 1. Atmosphere & Identity

Pi Desktop 的主界面是一个安静、克制的桌面控制台。信息密度高，但通过浅灰层级、细边框和收束后的中心对话列把注意力压回当前会话。签名特征是“轻铬外壳 + 居中的聊天工作带”：四周是稳定的工具框架，中间的输入、消息和运行提醒保持紧凑、明确、可随时打断。

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/main | `--mm-bg-main` | `#f1f3f5` | `#1a1a1a` | 主工作区背景 |
| Surface/sidebar | `--mm-bg-sidebar` | `#eef1f4` | `#242424` | 左侧栏、运行提醒底 |
| Surface/panel | `--mm-bg-panel` | `#f6f7f9` | `#242424` | 助手气泡、浮层、卡片 |
| Surface/composer | `--mm-bg-composer` | `#f9f9fb` | `#20242a` | 全局输入区外壳 |
| Surface/control | `--mm-bg-control` | `#fbfbfb` | `#171b20` | 输入区内嵌控制胶囊 |
| Surface/input | `--mm-bg-input` | `#ffffff` | `#171b20` | 文本输入本体 |
| Surface/hover | `--mm-bg-hover` | `#e8f0fa` | `#2a2a2a` | hover、轻提示 |
| Surface/selected | `--mm-bg-selected` | `#c1d2ec` | `#303030` | 选中态、禁用浅化底 |
| Action/primary | `--mm-accent-blue` | `#0a68c4` | `#5aa7ff` | 发送、焦点、选中点缀 |
| Action/inverse | `--mm-bg-active` | `#1a1a1a` | `#ffffff` | 停止按钮、运行点、强反差态 |
| Text/primary | `--mm-text-primary` | `#1a1a1a` | `#e5e5e5` | 主文案 |
| Text/secondary | `--mm-text-secondary` | `#666666` | `#999999` | 说明、元数据 |
| Text/tertiary | `--mm-text-tertiary` | `#999999` | `#666666` | 占位、弱状态 |
| Text/on-active | `--mm-text-on-active` | `#ffffff` | `#1a1a1a` | 深底/浅底强反差按钮文字 |
| Border/default | `--mm-border` | `#dde4eb` | `#333333` | 主要边框 |
| Border/subtle | `--mm-border-subtle` | `#edf0f3` | `#2b3036` | 轻分割 |
| Border/strong | `--mm-border-strong` | `#c7d2df` | `#4a5360` | 焦点、悬停强化 |
| Status/success | `--color-success` | `#10b981` | `#34d399` | 成功、已完成 |
| Status/error | `--color-error` | `#ef4444` | `#f87171` | 错误、停止失败 |

### Rules
- 主操作只用 `--mm-accent-blue` 或 `--mm-bg-active`，不要把成功/错误色拿来做常规交互按钮。
- 运行中状态优先靠动态指示和反差色表达，不靠整块高饱和底色。
- 新颜色先写进这里，再进入组件。

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| H1 | 28px | 600 | 1.2 | `-0.02em` | 设置页标题 |
| H2 | 20px | 600 | 1.25 | `-0.01em` | 模块标题 |
| H3 | 16px | 600 | 1.35 | `0` | 卡片/区块标题 |
| Body | 14px | 400 | 1.5 | `0` | 默认正文、输入区 |
| Body/sm | 13px | 400 | 1.45 | `0` | 紧凑正文 |
| Caption | 12px | 500 | 1.4 | `0.01em` | 说明、标签 |
| Meta | 11px | 500 | 1.35 | `0.02em` | 时间戳、弱状态 |
| Mono/meta | 12px | 500 | 1.35 | `0` | token、命令、统计 |

### Font Stack
- Primary: `Inter, -apple-system, BlinkMacSystemFont, sans-serif`
- Mono: `JetBrains Mono, Fira Code, Consolas, monospace`

### Rules
- 聊天正文默认 14px，不再缩到 12px。
- 时间戳和状态文案保持 11px-12px，不与正文抢层级。
- 命令、路径、token 走 mono，其余保持 sans。

## 4. Spacing & Layout

### Base Unit

所有间距基于 4px。

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | 点与字、微间距 |
| `--space-2` | 8px | 紧凑内边距 |
| `--space-3` | 12px | 组件内常规间距 |
| `--space-4` | 16px | 消息气泡、输入壳常规 padding |
| `--space-5` | 20px | 组件组间距 |
| `--space-6` | 24px | 区块间距 |
| `--space-8` | 32px | 大区块间距 |

### Grid
- 左侧栏宽：`190px`
- 右侧栏宽：`280px`
- 聊天主列最大宽：`780px`
- 助手消息推荐列宽：`42rem` 以内，保持居中，不再铺满整行
- 断点沿用 Tailwind 默认：`sm 640 / md 768 / lg 1024 / xl 1280`

### Rules
- 用户消息保持右对齐，但正文不超过可读宽度。
- 助手消息、计划卡、运行提醒都应锁在中心工作带内，不要拉满聊天列。
- 输入区底部控制条保持单行，运行态按钮允许收成正方形停止键。

## 5. Components

### Chat Input Shell
- Structure: `outer shell -> optional running strip -> attachments -> textarea body -> bottom controls`
- Variants: `referenceFrame`, `standard`
- Spacing: 壳体 `12px-16px`，控制条高度 `34px`
- States: default, hover, focus-within, disabled, running
- Accessibility: textarea 始终可聚焦；主按钮必须提供 `aria-label`
- Motion: 150ms hover/focus 过渡；运行态指示允许 ping/pulse

### Primary Composer Action
- Structure: 单按钮图标控制
- Variants: `send`, `stop`, `pause`
- Spacing: 默认发送按钮可为窄矩形；运行态必须收成正方形
- States: default, hover, disabled, running
- Accessibility: `send` 与 `stop` 需要不同 aria 文案
- Motion: 仅透明度/阴影过渡，不做位移动画

### Message Bubble
- Structure: `timestamp -> bubble card -> optional thinking/tool/generated-ui/footer`
- Variants: `assistant`, `user`, `user-plan-execution`, `search-target`
- Spacing: 用户气泡内边距 `12px 16px`，上下等距；助手常规回复只保留中心列和文本内边距，不使用整块背景
- States: default, streaming, highlighted, copy-success, copy-error
- Accessibility: 外层 `article`；复制失败用 `role="alert"`
- Motion: 搜索命中仅 ring 强调，不做位移动画

### Generated Plan Surface
- Structure: `header/status -> summary/details -> optional steps/options -> action row`
- Variants: pending, executing, paused, terminal, write-error
- Spacing: 单层面板 `8px` radius，内部用细分割线和留白分区，不再在消息气泡里叠卡片
- States: pending choice selection, executing progress, paused resume, terminal summary
- Accessibility: 主执行按钮保持明确 `aria` 文案；文件名可点击时保留完整路径 tooltip
- Motion: 只让运行点 pulse，面板容器本身不做整体呼吸动画

### Thinking Block
- Structure: `toggle row -> optional expanded content`
- Variants: collapsed, expanded, streaming
- Spacing: 顶部按钮 `4px-8px`，展开内容左侧细分割线
- States: default, hover, expanded, streaming
- Accessibility: `aria-expanded` 和状态化 `aria-label`
- Motion: streaming 指示用 opacity/ping，不要闪烁整行文本

### Progress Reminder
- Structure: `animated running dot -> title/body -> stop or pause button`
- Variants: `task`, `plan_execution`
- Spacing: 卡片 padding `16px 16px 12px`
- States: visible, hidden, stopping, paused
- Accessibility: `role="status"`，操作按钮必须可键盘触发
- Motion: 运行点允许 ping；容器本身不做漂浮运动

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 150ms | `cubic-bezier(0.4, 0, 0.2, 1)` | hover、copy、按钮反馈 |
| Standard | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | 浮层、状态切换 |
| Running indicator | `~1s` loop | ease-in-out | 运行中 ping / pulse |

### Rules
- 只动画 `opacity`、`transform`、`box-shadow`。
- 运行中动画只用来表达“仍在执行”，不能变成装饰。
- `prefers-reduced-motion` 下允许静态降级为实心点。

### Motion primitives
- `pi-motion-rail`: 左侧结构轨道折叠/展开，外层只承担轨道尺寸过渡，内容用 `opacity + translateX` 软化进出。
- `pi-motion-floating-rail`: 右侧上下文浮层从右侧轻微滑入/滑出，保留阴影渐变，避免直接挂载跳出。
- `pi-motion-message-enter`: 新消息挂载时使用 220ms 的 `opacity + translateY` 进入；旧消息不做循环动画。
- `pi-motion-thinking-shell`: 思考状态出现和展开内容使用短进入动画；streaming 只让状态点 pulse。
- `pi-motion-running-strip`: 发送后进入运行态的提醒条从输入区上方淡入上移，停止时淡出，不改动输入布局。

## 7. Depth & Surface

### Strategy
`mixed`

| Layer | Value | Usage |
|-------|-------|-------|
| Border/default | `1px solid var(--mm-border)` | 输入区、消息气泡、提醒卡 |
| Shadow/subtle | `0 1px 2px rgba(0,0,0,0.02)` | 助手消息气泡 |
| Shadow/floating | `0 8px 24px rgba(15,23,42,0.12)` | 运行提醒、浮层 |
| Window | `var(--mm-window-shadow)` | 顶层透明窗口 |

### Rules
- 大多数层级靠边框和明度差，不靠重阴影。
- 只有浮层、提醒、窗口使用明显投影。
- 运行态按钮使用高对比实底，不再用禁用灰态冒充“可停止”。

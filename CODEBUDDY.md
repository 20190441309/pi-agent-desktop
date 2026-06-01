# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## 项目概述

Pi Desktop 是一个 Windows 桌面应用，为 Pi CLI 提供图形化聊天界面。基于 Electron + React 构建，采用 pnpm monorepo 工作区结构。

## 常用命令

```bash
# 安装依赖
pnpm install

# 开发模式启动（需要先 build packages）
pnpm -r run build          # 构建所有 packages
cd apps/desktop && pnpm run dev   # 启动 Electron 开发模式

# 构建
pnpm -r run build                    # 构建所有 packages
pnpm --filter @pi-desktop/pi-driver run build   # 构建单个 package

# 类型检查
pnpm -r run typecheck       # 全量类型检查
cd apps/desktop && pnpm run typecheck   # 仅 desktop

# Lint
pnpm -r run lint

# 测试
cd apps/desktop && pnpm run test    # 使用 vitest

# 打包 Windows 安装包
cd apps/desktop && pnpm run package
```

## 架构

### Monorepo 结构

```
pi-desktop/
├── apps/desktop/           # Electron 主应用
│   ├── src/main/           # Electron 主进程（IPC、窗口管理、Pi CLI 通信）
│   ├── src/preload/        # Preload 脚本（安全桥接 piAPI/nodeAPI）
│   └── src/renderer/       # React 渲染进程
├── packages/
│   ├── pi-driver/          # Pi CLI 驱动封装
│   └── shared-types/       # 共享 TypeScript 类型
└── scripts/dev.ts          # 开发启动脚本
```

### Electron 三层架构

1. **Main Process** (`apps/desktop/src/main/index.ts`)
   - 管理 BrowserWindow 生命周期
   - 通过 `electron-store` 持久化 workspace/session/settings
   - 加载 Pi Agent 配置（`~/.pi/agent/` 下的 `settings.json`、`models.json`、`models.yml`）
   - 注册所有 IPC handler（`pi:prompt`、`workspace:*`、`session:*`、`git:status`、`settings:*`）
   - Pi CLI 通信采用 `--print` 管道模式，每次 prompt 独立 spawn 进程

2. **Preload** (`apps/desktop/src/preload/index.ts`)
   - 通过 `contextBridge` 暴露 `window.piAPI` 和 `window.nodeAPI`
   - 所有渲染进程与主进程的通信都通过此桥接

3. **Renderer** (`apps/desktop/src/renderer/src/`)
   - React 19 + TypeScript + Vite + Tailwind CSS 4
   - 状态管理：Zustand stores（`session-store`、`workspace-store`、`settings-store`、`plugin-store`）
   - 路径别名：`@` 映射到 `src/renderer/src`

### 渲染进程组件结构

```
components/
├── ChatView/        # 聊天核心（ChatView、ChatInput、MessageBubble、CommandCard、CodeBlock、MarkdownRenderer、ToolCallCard）
├── FloatingPanel/   # 右侧悬浮进度面板
├── GitPanel/        # Git 状态面板
├── IconBar/         # 左侧图标栏
├── ProjectPanel/    # 项目/工作区面板
├── Sidebar/         # 侧边栏
├── Settings/        # 设置页
├── ResizablePanel.tsx
└── common/          # 通用组件
```

### IPC 通信模式

渲染进程调用 `window.piAPI.xxx()` → preload 转发 → main process 的 `ipcMain.handle` 处理。
Pi CLI 流式响应通过 `mainWindow.webContents.send('pi:event', ...)` 推送回渲染进程，事件类型包括 `text_start`、`text_delta`、`turn_end`、`error`。

### 技术栈

- Electron 34 + electron-vite 2
- React 19 + TypeScript 5 + Vite 6
- Tailwind CSS 4 + PostCSS
- Zustand 5（状态管理）
- electron-store（持久化）
- react-markdown + rehype-highlight（Markdown 渲染）
- diff2html（代码 diff 可视化）
- vitest（测试）

### 构建配置

- TypeScript：`tsconfig.base.json` 定义共享配置，strict 模式，target ES2022
- Vite：`electron.vite.config.ts` 分别配置 main/preload/renderer 三个入口
- 打包：`electron-builder.yml`，支持 Windows NSIS 安装包
- Path alias：`@pi-desktop/*` 映射到 `packages/*/src`

## 注意事项

- 前端使用浅灰白色主题（非深色），配色参见 `DESIGN.md`
- Pi CLI 配置从 `~/.pi/agent/` 目录读取，不存储 API Key 到应用
- workspace 和 session 数据通过 `electron-store` 持久化到用户本地

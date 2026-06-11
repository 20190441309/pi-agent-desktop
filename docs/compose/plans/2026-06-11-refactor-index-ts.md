# Refactor: index.ts 拆分 + 代码清理 + pre-commit hooks

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 922 行的 `apps/desktop/src/main/index.ts` 按域拆分为独立 IPC 文件，清理文档/注释/截图，并加上 pre-commit hooks。

**Architecture:** 遵循现有 `ipc/*.ipc.ts` 模式（chat.ipc.ts、sessions.ipc.ts 等），将 setupIPC() 中内联的 ~500 行 IPC handler 按域提取到 4 个新文件。每个文件导出一个 `setup*()` 函数，接收所需依赖（store、mainWindow、piDriver 等）。

**Tech Stack:** TypeScript, Electron (ipcMain), electron-store, electron-log, lefthook

---

## File Structure

### 新建文件
- `apps/desktop/src/main/ipc/pi-driver.ipc.ts` — Pi Driver 管理 handlers (pi:status, pi:refresh-status, pi:install, pi:update, pi:uninstall, pi:cancel-operation)
- `apps/desktop/src/main/ipc/workspace.ipc.ts` — Workspace + file dialog handlers (workspace:*, files:select)
- `apps/desktop/src/main/ipc/git.ipc.ts` — Git handlers (git:status, git:diff, git:diff-staged, git:add, git:unstage, git:commit, git:log, git:branches)
- `apps/desktop/src/main/ipc/settings.ipc.ts` — Settings + Pi config handlers (settings:get, settings:set, settings:load-pi-config, pi:get-full-config, pi:list-skills, log:write)
- `apps/desktop/src/main/ipc/window.ipc.ts` — Window control handlers (window:minimize, window:toggle-maximize, window:is-maximized, window:close, window:maximize-changed event)
- `lefthook.yml` — Pre-commit hooks config

### 修改文件
- `apps/desktop/src/main/index.ts` — 删除内联 handlers，改为调用 setup*() 函数
- `README.md` — 修正 Electron 34→41, Vitest 2→4
- `package.json` (root) — 加 lefthook devDependency + prepare script
- `.gitignore` — 加 test-screenshot*.png, screenshot*.png 排除规则

### 删除/移动文件
- 根目录 `test-screenshot*.png`, `screenshot*.png` → `docs/screenshots/` (保留最有用的 1-2 张，其余 gitignore)

---

### Task 1: 拆分 git.ipc.ts

**Files:**
- Create: `apps/desktop/src/main/ipc/git.ipc.ts`
- Modify: `apps/desktop/src/main/index.ts` (删除 lines 521-690，改为调用 setupGitIpc)

- [ ] **Step 1: 创建 git.ipc.ts**

```typescript
// apps/desktop/src/main/ipc/git.ipc.ts
import { ipcMain } from 'electron';
import { execFileSync } from 'child_process';
import log from 'electron-log/main';
import { ipcError } from '@shared';
import { gitAdd, gitCommit, gitDiff, gitDiffStaged, getGitStatus, gitUnstage } from '../services/git-service';
import { getProtectedPathReason } from '../services/protected-paths';
import { gitAddSchema, gitCommitSchema, gitDiffSchema, gitDiffStagedSchema } from './schemas';

export function setupGitIpc(): void {
  ipcMain.handle('git:status', async (_, workspacePath: string) => {
    try {
      return getGitStatus(workspacePath);
    } catch (err) {
      log.error("[git.ipc] git:status failed:", err);
      return ipcError(
        "ipcErrors.git.statusFailed",
        `读取 git 状态失败: ${err instanceof Error ? err.message : String(err)}`,
        { path: workspacePath },
      );
    }
  });

  ipcMain.handle('git:diff', async (_, workspacePath: string, filePath?: string) => {
    try {
      gitDiffSchema.parse(filePath === undefined ? [workspacePath] : [workspacePath, filePath]);
    } catch (err) {
      log.warn("[git.ipc] git:diff invalid args:", err);
      return ipcError(
        "ipcErrors.git.invalidArgs",
        `git diff 参数无效: ${err instanceof Error ? err.message : String(err)}`,
        { path: String(filePath ?? "") },
      );
    }
    try {
      return gitDiff(workspacePath, filePath);
    } catch (err) {
      log.error("[git.ipc] git:diff failed:", err);
      return ipcError(
        "ipcErrors.git.diffFailed",
        `读取 git diff 失败: ${err instanceof Error ? err.message : String(err)}`,
        { path: filePath ?? "all" },
      );
    }
  });

  ipcMain.handle('git:diff-staged', async (_, workspacePath: string) => {
    try {
      gitDiffStagedSchema.parse([workspacePath]);
    } catch (err) {
      log.warn("[git.ipc] git:diff-staged invalid args:", err);
      return ipcError(
        "ipcErrors.git.invalidArgs",
        `git staged diff 参数无效: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    try {
      return gitDiffStaged(workspacePath);
    } catch (err) {
      log.error("[git.ipc] git:diff-staged failed:", err);
      return ipcError(
        "ipcErrors.git.diffFailed",
        `读取 staged diff 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('git:add', async (_, workspacePath: string, files: string[]) => {
    try {
      gitAddSchema.parse([workspacePath, files]);
    } catch (err) {
      log.warn("[git.ipc] git:add invalid args:", err);
      return ipcError(
        "ipcErrors.git.invalidArgs",
        `git add 参数无效: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (files.length === 0) return;
    try {
      return gitAdd(workspacePath, files);
    } catch (err) {
      log.error("[git.ipc] git:add exec failed:", err);
      return ipcError(
        "ipcErrors.git.addFailed",
        `git add 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('git:unstage', async (_, workspacePath: string, files: string[]) => {
    try {
      gitAddSchema.parse([workspacePath, files]);
    } catch (err) {
      log.warn("[git.ipc] git:unstage invalid args:", err);
      return ipcError(
        "ipcErrors.git.invalidArgs",
        `git unstage 参数无效: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (files.length === 0) return undefined;
    try {
      return gitUnstage(workspacePath, files);
    } catch (err) {
      log.error("[git.ipc] git:unstage exec failed:", err);
      return ipcError(
        "ipcErrors.git.unstageFailed",
        `git unstage 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('git:commit', async (_, workspacePath: string, message: string) => {
    try {
      gitCommitSchema.parse([workspacePath, message]);
    } catch (err) {
      log.warn("[git.ipc] git:commit invalid args:", err);
      return ipcError(
        "ipcErrors.git.invalidArgs",
        `git commit 参数无效: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    try {
      return gitCommit(workspacePath, message);
    } catch (err) {
      log.error("[git.ipc] git:commit exec failed:", err);
      return ipcError(
        "ipcErrors.git.commitFailed",
        `git commit 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('git:log', async (_, workspacePath: string, count: number = 20) => {
    const logPathReason = getProtectedPathReason(workspacePath);
    if (logPathReason) {
      return ipcError("ipcErrors.git.protectedPath", logPathReason, { path: workspacePath });
    }
    try {
      const format = '--pretty=format:{"hash":"%h","author":"%an","date":"%ai","message":"%s"}';
      const output = execFileSync('git', ['log', format, '-n', String(count)], { cwd: workspacePath, encoding: 'utf-8' });
      return output.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
    } catch (err) {
      log.error("[git.ipc] git:log failed:", err);
      return ipcError(
        "ipcErrors.git.logFailed",
        `读取 git log 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('git:branches', async (_, workspacePath: string) => {
    const branchPathReason = getProtectedPathReason(workspacePath);
    if (branchPathReason) {
      return ipcError("ipcErrors.git.protectedPath", branchPathReason, { path: workspacePath });
    }
    try {
      const output = execFileSync('git', ['branch', '-a'], { cwd: workspacePath, encoding: 'utf-8' });
      return output.split('\n').filter(l => l.trim()).map(l => ({
        name: l.replace(/^\*?\s+/, '').trim(),
        isCurrent: l.startsWith('*'),
        isRemote: l.includes('remotes/')
      }));
    } catch (err) {
      log.error("[git.ipc] git:branches failed:", err);
      return ipcError(
        "ipcErrors.git.branchesFailed",
        `读取 git branches 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });
}
```

- [ ] **Step 2: 在 index.ts 中替换内联 git handlers**

删除 lines 521-690 的所有 `git:*` handlers，替换为：

```typescript
setupGitIpc();
```

同时在顶部 import 区加上：

```typescript
import { setupGitIpc } from './ipc/git.ipc';
```

同时删除不再需要的 imports（git-service 函数、git schemas、getProtectedPathReason、execFileSync）。**注意：先检查其他代码是否还用到这些 imports，只删没人用的。**

- [ ] **Step 3: 验证**

```bash
pnpm --filter @pi-desktop/desktop typecheck
pnpm --filter @pi-desktop/desktop test
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main/ipc/git.ipc.ts apps/desktop/src/main/index.ts
git commit -m "refactor(ipc): extract git handlers to git.ipc.ts"
```

---

### Task 2: 拆分 workspace.ipc.ts

**Files:**
- Create: `apps/desktop/src/main/ipc/workspace.ipc.ts`
- Modify: `apps/desktop/src/main/index.ts` (删除 lines 418-507，改为调用 setupWorkspaceIpc)

- [ ] **Step 1: 创建 workspace.ipc.ts**

```typescript
// apps/desktop/src/main/ipc/workspace.ipc.ts
import { ipcMain, dialog, type BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import log from 'electron-log/main';
import type { Store } from 'electron-store';
import { ipcError } from '@shared';
import { workspaceCreateSchema } from './schemas';

interface Workspace {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  lastActiveAt?: number;
}

interface WorkspaceStoreSchema {
  workspaces: Workspace[];
}

export function setupWorkspaceIpc(opts: {
  store: Store<WorkspaceStoreSchema>;
  getMainWindow: () => BrowserWindow | null;
}): void {
  const { store, getMainWindow } = opts;

  ipcMain.handle('workspace:list', async () => {
    let workspaces = store.get('workspaces');
    if (workspaces.length === 0) {
      workspaces = [{
        id: 'default',
        name: 'Default',
        path: process.cwd(),
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      }];
      store.set('workspaces', workspaces);
    }
    return workspaces;
  });

  ipcMain.handle('workspace:create', async (_, name: string, path: string) => {
    try {
      workspaceCreateSchema.parse([name, path]);
    } catch (err) {
      log.warn("[workspace.ipc] workspace:create invalid args:", err);
      return ipcError(
        "ipcErrors.workspace.invalidArgs",
        `工作区参数无效: ${err instanceof Error ? err.message : String(err)}`,
        { name, path },
      );
    }
    const workspace = {
      id: randomUUID(),
      name,
      path,
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    };
    const workspaces = store.get('workspaces');
    workspaces.push(workspace);
    store.set('workspaces', workspaces);
    return workspace;
  });

  ipcMain.handle('workspace:delete', async (_, id: string) => {
    const workspaces = store.get('workspaces').filter(w => w.id !== id);
    store.set('workspaces', workspaces);
  });

  ipcMain.handle('workspace:select', async (_, path: string) => {
    log.info('Workspace selected:', path);
  });

  ipcMain.handle('workspace:select-directory', async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Workspace Directory'
      });
      return result.canceled ? null : result.filePaths[0];
    } catch (err) {
      log.error("[workspace.ipc] workspace:select-directory failed:", err);
      return ipcError(
        "ipcErrors.workspace.selectDirectoryFailed",
        `打开目录选择器失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('files:select', async (
    _,
    opts?: { multiSelections?: boolean; filters?: { name: string; extensions: string[] }[] },
  ) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return [];
    try {
      const properties: Array<'openFile' | 'multiSelections'> = ['openFile'];
      if (opts?.multiSelections !== false) properties.push('multiSelections');
      const result = await dialog.showOpenDialog(mainWindow, {
        properties,
        title: '选择附件',
        filters: opts?.filters,
      });
      return result.canceled ? [] : result.filePaths;
    } catch (err) {
      log.error("[workspace.ipc] files:select failed:", err);
      return ipcError(
        "ipcErrors.files.selectFailed",
        `打开文件选择器失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });
}
```

- [ ] **Step 2: 在 index.ts 中替换内联 workspace + files:select handlers**

删除 lines 418-507 的所有 `workspace:*` 和 `files:select` handlers，替换为：

```typescript
setupWorkspaceIpc({ store, getMainWindow: () => mainWindow });
```

同时在顶部 import 区加上：

```typescript
import { setupWorkspaceIpc } from './ipc/workspace.ipc';
```

同时删除不再需要的 imports（dialog、randomUUID、workspaceCreateSchema）。

- [ ] **Step 3: 验证**

```bash
pnpm --filter @pi-desktop/desktop typecheck
pnpm --filter @pi-desktop/desktop test
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main/ipc/workspace.ipc.ts apps/desktop/src/main/index.ts
git commit -m "refactor(ipc): extract workspace + file dialog handlers to workspace.ipc.ts"
```

---

### Task 3: 拆分 settings.ipc.ts

**Files:**
- Create: `apps/desktop/src/main/ipc/settings.ipc.ts`
- Modify: `apps/desktop/src/main/index.ts` (删除 lines 703-831)

- [ ] **Step 1: 创建 settings.ipc.ts**

```typescript
// apps/desktop/src/main/ipc/settings.ipc.ts
import { ipcMain } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import log from 'electron-log/main';
import type { Store } from 'electron-store';
import { ipcError } from '@shared';
import type { AppSettings } from '@shared';
import { settingsSetSchema } from './schemas';

interface PiAgentConfig {
  defaultProvider: string;
  defaultModel: string;
  providers: Array<{
    id: string;
    name: string;
    baseUrl?: string;
    models: Array<{
      id: string;
      name: string;
      provider: string;
      providerName: string;
      contextWindow?: number;
      maxTokens?: number;
      reasoning?: boolean;
      input?: string[];
    }>;
  }>;
}

interface SettingsStoreSchema {
  settings: AppSettings;
}

export function setupSettingsIpc(opts: {
  store: Store<SettingsStoreSchema>;
  getPiAgentConfig: () => PiAgentConfig | null;
  piAgentDir: string;
}): void {
  const { store, getPiAgentConfig, piAgentDir } = opts;

  ipcMain.handle('settings:get', async () => {
    return store.get('settings');
  });

  ipcMain.handle('settings:set', async (_, settings: Partial<AppSettings>) => {
    try {
      settingsSetSchema.parse([settings]);
    } catch (err) {
      log.warn("[settings.ipc] settings:set invalid args:", err);
      return ipcError(
        "ipcErrors.settings.invalidArgs",
        `设置参数无效: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const current = store.get('settings');
    const updated = { ...current, ...settings };
    store.set('settings', updated);
    return updated;
  });

  ipcMain.handle('settings:load-pi-config', async () => {
    const piAgentConfig = getPiAgentConfig();
    if (!piAgentConfig) return { models: [], currentModel: null };

    const models = piAgentConfig.providers.flatMap(p =>
      p.models.map(m => ({
        id: m.id,
        name: m.name,
        provider: p.id,
        providerName: p.name,
        description: `${p.name} · ${m.reasoning ? '推理' : '通用'} · ${m.contextWindow ? `${Math.round(m.contextWindow / 1000)}K` : '未知'}上下文`,
        maxTokens: m.maxTokens
      }))
    );

    const currentModel = piAgentConfig.defaultModel ? {
      model: piAgentConfig.defaultModel,
      provider: piAgentConfig.defaultProvider
    } : null;

    if (currentModel) {
      const currentSettings = store.get('settings');
      if (!currentSettings.model && !currentSettings.provider) {
        store.set('settings', {
          ...currentSettings,
          model: currentModel.model,
          provider: currentModel.provider,
        });
      }
    }

    return { models, currentModel };
  });

  ipcMain.handle('pi:get-full-config', async () => {
    const piAgentConfig = getPiAgentConfig();
    if (!piAgentConfig) {
      return {
        configPath: piAgentDir,
        defaultProvider: 'google',
        defaultModel: '',
        providers: []
      };
    }

    return {
      configPath: piAgentDir,
      defaultProvider: piAgentConfig.defaultProvider,
      defaultModel: piAgentConfig.defaultModel,
      providers: piAgentConfig.providers.map(p => ({
        id: p.id,
        name: p.name,
        baseUrl: p.baseUrl,
        modelCount: p.models.length,
        hasApiKey: false
      }))
    };
  });

  ipcMain.handle('pi:list-skills', async () => {
    try {
      const skillsDir = join(process.cwd(), '.agents', 'skills');
      if (!existsSync(skillsDir)) return [];

      const entries = readdirSync(skillsDir, { withFileTypes: true });
      const skills = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = join(skillsDir, entry.name);
          let description = '';

          const skillMdPath = join(skillPath, 'SKILL.md');
          if (existsSync(skillMdPath)) {
            try {
              const content = readFileSync(skillMdPath, 'utf-8');
              const lines = content.split('\n').filter((l: string) => l.trim());
              for (const line of lines) {
                if (!line.startsWith('#') && line.trim().length > 0) {
                  description = line.trim().substring(0, 100);
                  break;
                }
              }
            } catch {
              // ignore read errors
            }
          }

          skills.push({
            name: entry.name,
            description,
            path: skillPath,
            enabled: true
          });
        }
      }

      return skills;
    } catch (error) {
      log.error('Failed to list skills:', error);
      return [];
    }
  });
}
```

- [ ] **Step 2: 在 index.ts 中替换**

删除 lines 703-831 的所有 settings/pi-config/list-skills handlers，替换为：

```typescript
setupSettingsIpc({
  store,
  getPiAgentConfig: () => piAgentConfig,
  piAgentDir: PI_AGENT_DIR,
});
```

同时在顶部 import 区加上：

```typescript
import { setupSettingsIpc } from './ipc/settings.ipc';
```

删除不再需要的 imports（existsSync, readFileSync, readdirSync, settingsSetSchema 等，保留其他代码用到的）。

- [ ] **Step 3: 验证**

```bash
pnpm --filter @pi-desktop/desktop typecheck
pnpm --filter @pi-desktop/desktop test
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main/ipc/settings.ipc.ts apps/desktop/src/main/index.ts
git commit -m "refactor(ipc): extract settings + pi-config handlers to settings.ipc.ts"
```

---

### Task 4: 拆分 window.ipc.ts

**Files:**
- Create: `apps/desktop/src/main/ipc/window.ipc.ts`
- Modify: `apps/desktop/src/main/index.ts` (删除 lines 836-864)

- [ ] **Step 1: 创建 window.ipc.ts**

```typescript
// apps/desktop/src/main/ipc/window.ipc.ts
import { ipcMain, type BrowserWindow } from 'electron';

export function setupWindowIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle("window:minimize", () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.minimize();
  });

  ipcMain.handle("window:toggle-maximize", () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle("window:is-maximized", () => {
    const win = getMainWindow();
    return win && !win.isDestroyed() ? win.isMaximized() : false;
  });

  ipcMain.handle("window:close", () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.close();
  });
}

export function setupWindowEvents(getMainWindow: () => BrowserWindow | null): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    const sendMaximizeState = (maximized: boolean): void => {
      const w = getMainWindow();
      if (w && !w.isDestroyed()) {
        w.webContents.send("window:maximize-changed", maximized);
      }
    };
    win.on("maximize", () => sendMaximizeState(true));
    win.on("unmaximize", () => sendMaximizeState(false));
  }
}
```

- [ ] **Step 2: 在 index.ts 中替换**

删除 lines 836-864 的 window handlers 和事件监听，替换为：

```typescript
setupWindowIpc(() => mainWindow);
setupWindowEvents(() => mainWindow);
```

在顶部 import 区加上：

```typescript
import { setupWindowIpc, setupWindowEvents } from './ipc/window.ipc';
```

- [ ] **Step 3: 验证**

```bash
pnpm --filter @pi-desktop/desktop typecheck
pnpm --filter @pi-desktop/desktop test
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main/ipc/window.ipc.ts apps/desktop/src/main/index.ts
git commit -m "refactor(ipc): extract window control handlers to window.ipc.ts"
```

---

### Task 5: 拆分 pi-driver.ipc.ts

**Files:**
- Create: `apps/desktop/src/main/ipc/pi-driver.ipc.ts`
- Modify: `apps/desktop/src/main/index.ts` (删除 lines 324-414)

- [ ] **Step 1: 创建 pi-driver.ipc.ts**

```typescript
// apps/desktop/src/main/ipc/pi-driver.ipc.ts
import { ipcMain } from 'electron';
import log from 'electron-log/main';
import { ipcError } from '@shared';
import type { PiDriver } from '../pi-driver';

export function setupPiDriverIpc(getPiDriver: () => PiDriver | null): void {
  ipcMain.handle('pi:status', async () => {
    const piDriver = getPiDriver();
    if (!piDriver) {
      return ipcError("ipcErrors.pi.driverNotInitialized", "PiDriver 尚未初始化");
    }
    return piDriver.detectSync();
  });

  ipcMain.handle('pi:refresh-status', async () => {
    const piDriver = getPiDriver();
    if (!piDriver) {
      return ipcError("ipcErrors.pi.driverNotInitialized", "PiDriver 尚未初始化");
    }
    try {
      return await piDriver.detect();
    } catch (err) {
      log.error("[pi-driver.ipc] pi:refresh-status failed:", err);
      return ipcError(
        "ipcErrors.pi.detectFailed",
        `Pi 状态检测失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('pi:install', async () => {
    const piDriver = getPiDriver();
    if (!piDriver) {
      return ipcError("ipcErrors.pi.driverNotInitialized", "PiDriver 尚未初始化");
    }
    try {
      await piDriver.install();
      return piDriver.detectSync();
    } catch (err) {
      log.error("[pi-driver.ipc] pi:install failed:", err);
      return ipcError(
        "ipcErrors.pi.installFailed",
        `安装 Pi CLI 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('pi:update', async () => {
    const piDriver = getPiDriver();
    if (!piDriver) {
      return ipcError("ipcErrors.pi.driverNotInitialized", "PiDriver 尚未初始化");
    }
    try {
      await piDriver.update();
      return piDriver.detectSync();
    } catch (err) {
      log.error("[pi-driver.ipc] pi:update failed:", err);
      return ipcError(
        "ipcErrors.pi.updateFailed",
        `更新 Pi CLI 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('pi:uninstall', async () => {
    const piDriver = getPiDriver();
    if (!piDriver) {
      return ipcError("ipcErrors.pi.driverNotInitialized", "PiDriver 尚未初始化");
    }
    try {
      await piDriver.uninstall();
      return piDriver.detectSync();
    } catch (err) {
      log.error("[pi-driver.ipc] pi:uninstall failed:", err);
      return ipcError(
        "ipcErrors.pi.uninstallFailed",
        `卸载 Pi CLI 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('pi:cancel-operation', async () => {
    getPiDriver()?.cancelOperation();
  });
}
```

- [ ] **Step 2: 在 index.ts 中替换**

删除 lines 324-414 的所有 `pi:*` driver handlers（保留 `// 注: pi:stop` 那行注释），替换为：

```typescript
setupPiDriverIpc(() => piDriver);
```

在顶部 import 区加上：

```typescript
import { setupPiDriverIpc } from './ipc/pi-driver.ipc';
```

- [ ] **Step 3: 验证**

```bash
pnpm --filter @pi-desktop/desktop typecheck
pnpm --filter @pi-desktop/desktop test
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main/ipc/pi-driver.ipc.ts apps/desktop/src/main/index.ts
git commit -m "refactor(ipc): extract pi-driver handlers to pi-driver.ipc.ts"
```

---

### Task 6: 拆分 log:write + 清理 index.ts 残余 imports

**Files:**
- Modify: `apps/desktop/src/main/ipc/settings.ipc.ts` (加 log:write handler)
- Modify: `apps/desktop/src/main/index.ts` (删除 log:write handler + 清理 imports)

- [ ] **Step 1: 将 log:write 移到 settings.ipc.ts 末尾**

在 `setupSettingsIpc()` 函数末尾（`pi:list-skills` handler 之后）加：

```typescript
ipcMain.on('log:write', (_event, level: string, message: string, extra: unknown) => {
  const safeLevel: "error" | "warn" | "info" | "debug" =
    level === "error" || level === "warn" || level === "info" || level === "debug"
      ? level
      : "info";
  const safeExtra = Array.isArray(extra) ? (extra as unknown[]) : [];
  log[safeLevel]("[renderer] " + message, ...safeExtra);
});
```

- [ ] **Step 2: 从 index.ts 删除 log:write handler**

删除 lines 692-701 的 `ipcMain.on('log:write', ...)` 块。

- [ ] **Step 3: 清理 index.ts 顶部不再需要的 imports**

此时 index.ts 的 `setupIPC()` 应该只剩下：

```typescript
function setupIPC(): void {
  setupChatIpc({ ... });
  setupAgentsIpc(agentRegistry);
  setupConfigIpc(configManager);
  setupCodexSessionsIpc(codexSessionImporter);
  setupFilesIpc();
  setupSkillsIpc({ ... });
  setupPiDriverIpc(() => piDriver);
  setupWorkspaceIpc({ store, getMainWindow: () => mainWindow });
  setupSessionsIpc({ ... });
  setupPackagesIpc();
  setupProjectShellIpc();
  setupGitIpc();
  setupSettingsIpc({ store, getPiAgentConfig: () => piAgentConfig, piAgentDir: PI_AGENT_DIR });
  setupTerminalIpc();
  setupWindowIpc(() => mainWindow);
  setupWindowEvents(() => mainWindow);
  setupAutoUpdater({ getMainWindow: () => mainWindow });
}
```

清理顶部不再需要的 imports：`execFileSync`、`randomUUID`、`dialog`、各种 git 函数、各种 schemas（只保留 setup 函数实际用到的）。

- [ ] **Step 4: 验证**

```bash
pnpm --filter @pi-desktop/desktop typecheck
pnpm --filter @pi-desktop/desktop test
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/ipc/settings.ipc.ts apps/desktop/src/main/index.ts
git commit -m "refactor(ipc): move log:write to settings.ipc, clean up residual imports"
```

---

### Task 7: 清理 README 版本号

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 修正 README.md 中的版本号**

找到并替换：

```
Electron 34 + React 19
```
→
```
Electron 41 + React 19
```

找到并替换：

```
**Frontend**: React 19 + TypeScript 5 + Vite 6 + Tailwind CSS 4
```
不变（已正确）。

找到并替换：

```
- **Test**: vitest 2 + @testing-library/react
```
→
```
- **Test**: vitest 4 + @testing-library/react
```

找到并替换：

```
- **Desktop**: Electron 34 + electron-vite
```
→
```
- **Desktop**: Electron 41 + electron-vite
```

找到并替换：

```
- **Node.js** >= 22.19.0 (Electron 34 bundled)
```
→
```
- **Node.js** >= 22.19.0 (Electron 41 bundled)
```

- [ ] **Step 2: 验证**

```bash
pnpm -r typecheck
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: fix stale Electron 34→41 and Vitest 2→4 version references"
```

---

### Task 8: 清理根目录截图 + .gitignore

**Files:**
- Move: 根目录截图文件 → `docs/screenshots/`
- Modify: `.gitignore`

- [ ] **Step 1: 创建 docs/screenshots/ 并移动文件**

```bash
mkdir -p docs/screenshots
mv test-screenshot*.png docs/screenshots/
mv screenshot*.png docs/screenshots/
```

保留 `test-screenshot-v1.0.12.png` 作为主要截图（最有代表性），其余可删除或保留。

- [ ] **Step 2: 更新 .gitignore**

在 `.gitignore` 末尾加：

```
# Dev/test screenshots at root (moved to docs/screenshots/)
/test-screenshot*.png
/screenshot*.png
```

- [ ] **Step 3: Commit**

```bash
git add docs/screenshots/ .gitignore
git rm --cached test-screenshot*.png screenshot*.png 2>$null
git commit -m "chore: move root screenshots to docs/screenshots/, update .gitignore"
```

---

### Task 9: 清理历史注释

**Files:**
- Modify: `apps/desktop/src/main/index.ts` (以及其他散落版本注释的文件)

这一步范围较小——只清理 index.ts 中最明显的几处：

- [ ] **Step 1: 清理 index.ts 中的版本标记注释**

删除或简化以下类型的注释（保留有技术价值的，删除纯版本标记）：

- `// v1.0.13: 多选文件 picker,ChatInput 附件按钮` → 删除（已移到 workspace.ipc.ts）
- `// v1.0.10 (H3): 渲染层日志转发...` → 简化为 `// Renderer log forwarding to main process electron-log`
- `// 2026-06-06 hotfix: 重构到 ipc/sessions.ipc.ts` → 删除（已移到 sessions.ipc.ts）
- `// M1: 替换老的 pi:prompt...` → 简化为 `// Pi session (long-lived AgentSession per workspace)`
- `// M2: 文件搜索` → 简化为 `// File search`
- `// M3: Skills 面板` → 简化为 `// Skills panel`
- `// M4: Terminal IPC` → 简化为 `// Terminal (node-pty)`
- `// M5: Auto-updater` → 简化为 `// Auto-updater`
- `// M7: 启动横幅` → 删除（main log.info 行已足够自解释）
- `// v1.1.0: renderer 接管 title bar` → 简化为 `// Custom title bar (renderer-controlled)`

- [ ] **Step 2: 验证**

```bash
pnpm --filter @pi-desktop/desktop typecheck
pnpm --filter @pi-desktop/desktop test
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/main/index.ts
git commit -m "refactor: clean up version-stamped comments in index.ts"
```

---

### Task 10: 加 pre-commit hooks (lefthook)

**Files:**
- Create: `lefthook.yml`
- Modify: `package.json` (root) — 加 devDependency + prepare script

- [ ] **Step 1: 安装 lefthook**

```bash
pnpm add -D -w lefthook
```

- [ ] **Step 2: 在 root package.json 加 prepare script**

在 `"scripts"` 中加：

```json
"prepare": "lefthook install"
```

- [ ] **Step 3: 创建 lefthook.yml**

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{ts,tsx}"
      run: pnpm -r lint --filter {staged_files}
    typecheck:
      run: pnpm -r typecheck
```

**注意**：`pnpm -r lint --filter {staged_files}` 可能不支持这种用法。更安全的方案是：

```yaml
pre-commit:
  parallel: true
  commands:
    typecheck:
      run: pnpm -r typecheck
    lint:
      run: pnpm -r lint
```

如果全量 lint 太慢，后续可以优化为只 lint staged files（需要 eslint 的 --cache 或 lint-staged）。

- [ ] **Step 4: 验证 lefthook 安装**

```bash
pnpm install
npx lefthook install
```

- [ ] **Step 5: Commit**

```bash
git add lefthook.yml package.json pnpm-lock.yaml
git commit -m "chore: add lefthook pre-commit hooks (typecheck + lint)"
```

---

### Task 11: 最终验证

- [ ] **Step 1: 全量验证**

```bash
pnpm -r typecheck && pnpm -r lint && pnpm -r test
```

- [ ] **Step 2: 检查 index.ts 最终行数**

```bash
wc -l apps/desktop/src/main/index.ts
```

预期：从 922 行降到 ~250-300 行（只剩 setup*() 调用 + app lifecycle + config loading）。

- [ ] **Step 3: 检查新文件都存在**

```bash
ls apps/desktop/src/main/ipc/
```

应包含：`git.ipc.ts`, `workspace.ipc.ts`, `settings.ipc.ts`, `window.ipc.ts`, `pi-driver.ipc.ts`（加上原有的 chat/sessions/files/skills/terminal/agents/config/codex-sessions/project-shell/packages）。

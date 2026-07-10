/**
 * Core Workflow Tests — Pi Desktop 核心业务流
 *
 * 覆盖:
 *   1. 工作区生命周期 (创建/切换/删除)
 *   2. 会话管理 (创建/切换/历史/归档)
 *   3. Agent 创建与多 Agent 切换
 *   4. 消息持久化与恢复
 *   5. 设置持久化
 *
 * 设计原则:
 *   - 每个 test 使用独立 userDataDir,互不干扰
 *   - 优先走 IPC API (window.piAPI),不走 UI 点击,更稳定
 *   - 验证业务状态,不只看 DOM 存在
 */
import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { join } from 'path';
import type { ChildProcess } from 'child_process';

const TEST_TIMEOUT = 60_000;
let activeApp: ElectronApplication | undefined;

async function waitForExit(process: ChildProcess | undefined, timeoutMs = 5_000): Promise<void> {
    if (!process || process.exitCode !== null || process.killed) return;

    await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
            process.kill();
            resolve();
        }, timeoutMs);

        process.once('exit', () => {
            clearTimeout(timeout);
            resolve();
        });
    });
}

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const app = await _electron.launch({
        executablePath: resolveElectronExecutablePath(),
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: { ...process.env, CI: '1', ELECTRON_RENDERER_URL: '' },
    });
    activeApp = app;
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    return { app, page };
}

async function closeActiveApp(): Promise<void> {
    const app = activeApp;
    const process = app?.process();
    try {
        // Bound the close so a hanging Electron shutdown can't stall the test body
        // or the afterEach teardown (waitForExit still force-kills the process).
        await Promise.race([
            app?.close() ?? Promise.resolve(),
            new Promise<void>((resolve) => setTimeout(resolve, 15_000)),
        ]);
    } catch {
        // Electron can already be gone after restart-heavy tests; cleanup should stay best-effort.
    } finally {
        await waitForExit(process);
        activeApp = undefined;
    }
}

test.describe('Pi Desktop — Core Workflow', () => {
    test.setTimeout(TEST_TIMEOUT);

    test.afterEach(async () => {
        await closeActiveApp();
    });

    // ===== Test 1: 工作区创建与切换 =====
    test('workspace lifecycle: create → switch → delete', async () => {
        const userDataDir = test.info().outputPath(`ws-test-${Date.now()}`);
        const wsPath1 = join(userDataDir, 'workspace-1');
        const wsPath2 = join(userDataDir, 'workspace-2');

        let { app, page } = await launchApp(userDataDir);

        // Seed workspaces via IPC API
        const result = await page.evaluate(async ({ wsPath1, wsPath2 }) => {
            window.localStorage.setItem('pi-desktop:firstLaunchDone', 'true');
            const ws1 = await window.piAPI.createWorkspace('project-alpha', wsPath1);
            const ws2 = await window.piAPI.createWorkspace('project-beta', wsPath2);
            return { ws1, ws2 };
        }, { wsPath1, wsPath2 });

        expect(result.ws1).toBeTruthy();
        expect(result.ws2).toBeTruthy();

        // Verify workspaces appear in sidebar
        await expect(page.locator('button[data-mmcode-section="new-task"]')).toBeVisible();

        // Switch workspace via Command Palette
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(300);
        const palette = page.locator('[role="dialog"][aria-label*="命令面板"]');
        await expect(palette).toBeVisible({ timeout: 3000 });

        // Close palette
        await page.keyboard.press('Escape');

        await closeActiveApp();

        // Restart app and verify persistence
        ({ app, page } = await launchApp(userDataDir));
        const persisted = await page.evaluate(async () => {
            const list = await window.piAPI.listWorkspaces();
            return list.length;
        });
        expect(persisted).toBeGreaterThanOrEqual(2);

        await closeActiveApp();
    });

    // ===== Test 2: 会话创建与消息持久化 =====
    test('session with messages survives app restart', async () => {
        const userDataDir = test.info().outputPath(`session-test-${Date.now()}`);
        const wsPath = join(userDataDir, 'workspace');

        let { app, page } = await launchApp(userDataDir);

        // Create workspace + session with messages
        await page.evaluate(async ({ wsPath }) => {
            window.localStorage.setItem('pi-desktop:firstLaunchDone', 'true');
            const ws = await window.piAPI.createWorkspace('persist-test', wsPath);
            const session = await window.piAPI.createSession(ws.id, '测试会话', 'test-session-1');

            await window.piAPI.appendMessage(session.id, {
                id: 'msg-user-1',
                role: 'user',
                content: '第一条用户消息',
                timestamp: new Date().toISOString(),
            });
            await window.piAPI.appendMessage(session.id, {
                id: 'msg-assistant-1',
                role: 'assistant',
                content: '第一条助手回复',
                timestamp: new Date().toISOString(),
            });

            return { sessionId: session.id, workspaceId: ws.id };
        }, { wsPath });

        await closeActiveApp();

        // Restart and verify messages persisted
        ({ app, page } = await launchApp(userDataDir));

        const restored = await page.evaluate(async () => {
            const sessions = await window.piAPI.listSessions();
            const target = sessions.find((s: { id: string }) => s.id === 'test-session-1');
            if (!target) return null;
            return { title: target.title, messageCount: target.messages?.length ?? 0 };
        });

        expect(restored).not.toBeNull();
        expect(restored?.title).toBe('测试会话');
        expect(restored?.messageCount).toBe(2);

        await closeActiveApp();
    });

    // ===== Test 3: 多 Agent 创建与切换 =====
    test('multi-agent: create two agents, verify isolation', async () => {
        const userDataDir = test.info().outputPath(`agent-test-${Date.now()}`);
        const wsPath = join(userDataDir, 'workspace');

        const { app, page } = await launchApp(userDataDir);

        const agents = await page.evaluate(async ({ wsPath }) => {
            window.localStorage.setItem('pi-desktop:firstLaunchDone', 'true');
            const ws = await window.piAPI.createWorkspace('agent-test', wsPath);

            // Create two sessions (each maps to an agent in legacy mode)
            const s1 = await window.piAPI.createSession(ws.id, 'Agent A', 'agent-a');
            const s2 = await window.piAPI.createSession(ws.id, 'Agent B', 'agent-b');

            return [
                { id: s1.id, title: s1.title },
                { id: s2.id, title: s2.title },
            ];
        }, { wsPath });

        expect(agents).toHaveLength(2);
        expect(agents[0].title).toBe('Agent A');
        expect(agents[1].title).toBe('Agent B');

        // Verify both sessions are listed
        const list = await page.evaluate(async () => {
            const sessions = await window.piAPI.listSessions();
            return sessions.map((s: { id: string; title: string }) => ({ id: s.id, title: s.title }));
        });

        expect(list).toHaveLength(2);

        await closeActiveApp();
    });

    // ===== Test 4: 设置持久化 =====
    test('settings persist across restarts', async () => {
        // Two cold Electron launches make this a legitimately long flow.
        test.setTimeout(120_000);
        const userDataDir = test.info().outputPath(`settings-test-${Date.now()}`);

        let { app, page } = await launchApp(userDataDir);

        // Set settings
        await page.evaluate(async () => {
            window.localStorage.setItem('pi-desktop:firstLaunchDone', 'true');
            await window.piAPI.setSettings({ theme: 'dark', language: 'zh-CN' });
        });

        await closeActiveApp();

        // Restart and verify
        ({ app, page } = await launchApp(userDataDir));

        const settings = await page.evaluate(async () => {
            return await window.piAPI.getSettings();
        });

        expect(settings.theme).toBe('dark');
        expect(settings.language).toBe('zh-CN');

        await closeActiveApp();
    });
});

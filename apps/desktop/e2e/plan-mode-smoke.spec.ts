import { test, expect, _electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { getWindowByUrl } from "./support/electron-windows";

async function installTestIpc(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }) => {
    const target = globalThis as typeof globalThis & {
      __promptCalls?: Array<{ workspaceId: string; message: string }>;
    };
    target.__promptCalls = [];

    ipcMain.removeHandler('pi:status');
    ipcMain.handle('pi:status', async () => ({
      installed: true,
      localVersion: 'e2e',
      latestVersion: 'e2e',
      updateAvailable: false,
    }));

    ipcMain.removeHandler('pi:send');
    ipcMain.handle('pi:send', async (_event, workspaceId: string, message: string) => {
      target.__promptCalls?.push({ workspaceId, message });
      return undefined;
    });

    const g = globalThis as typeof globalThis & {
      __testWorkspaces?: Array<{ id: string; name: string; path: string; createdAt: number; lastActiveAt: number }>;
      __testCurrentWorkspaceId?: string | null;
    };
    g.__testWorkspaces = g.__testWorkspaces ?? [];
    g.__testCurrentWorkspaceId = g.__testCurrentWorkspaceId ?? null;

    ipcMain.removeHandler('workspace:create');
    ipcMain.handle('workspace:create', async (_event, name: string, path: string) => {
      const ws = { id: `ws_${name}_${Date.now()}`, name, path, createdAt: Date.now(), lastActiveAt: Date.now() };
      g.__testWorkspaces?.push(ws);
      g.__testCurrentWorkspaceId = ws.id;
      return ws;
    });

    ipcMain.removeHandler('workspace:select');
    ipcMain.handle('workspace:select', async (_event, path: string) => {
      const ws = g.__testWorkspaces?.find((w) => w.path === path);
      if (ws) g.__testCurrentWorkspaceId = ws.id;
      return undefined;
    });

    ipcMain.removeHandler('workspace:list');
    ipcMain.handle('workspace:list', async () => g.__testWorkspaces ?? []);

    ipcMain.removeHandler('session:create');
    ipcMain.handle('session:create', async (_event, workspaceId: string, title?: string, id?: string) => ({
      id: id ?? `session_${Date.now()}`,
      workspaceId,
      title: title ?? 'test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    }));

    ipcMain.removeHandler('session:list');
    ipcMain.handle('session:list', async () => []);

    ipcMain.removeHandler('plan:set-enabled');
    ipcMain.handle('plan:set-enabled', async () => undefined);

    ipcMain.removeHandler('agents:list');
    ipcMain.handle('agents:list', async () => []);

    ipcMain.removeHandler('agents:create');
    ipcMain.handle('agents:create', async () => ({ id: 'agent_test', workspaceId: 'ws_plan-test', title: 'Test Agent' }));

    ipcMain.removeHandler('agents:prompt');
    ipcMain.handle('agents:prompt', async (_event, input: { agentId: string; message: string }) => {
      const target = globalThis as typeof globalThis & { __promptCalls?: Array<{ workspaceId: string; message: string }> };
      target.__promptCalls?.push({ workspaceId: input.agentId, message: input.message });
      return undefined;
    });
  });
}

test.describe('Plan Mode Smoke Test', () => {
  let app: ElectronApplication;
  let page: Page;

  test.afterEach(async () => {
    try { await app?.close(); } catch { /* ignore */ }
  });

  test('plan mode sends project exploration directly as one /plan prompt', async () => {
    const userDataDir = test.info().outputPath(`user-data-${Date.now()}`);
    app = await _electron.launch({
        executablePath: resolveElectronExecutablePath(),
      args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
      env: { ...process.env, CI: '1' },
    });
    await app.firstWindow();
    page = await getWindowByUrl(app, 'index.html');

    page.on('console', (msg) => {
      console.log(`[RENDERER ${msg.type()}]`, msg.text());
    });

    await installTestIpc(app);

    // Setup: create workspace and skip onboarding
    await page.evaluate(async () => {
      window.localStorage.setItem('pi-desktop:firstLaunchDone', 'true');
      window.localStorage.setItem('pi-desktop.onboarding.completed', 'true');
      const ws = await window.piAPI.createWorkspace('plan-test', 'C:\\plan-test');
      await window.piAPI.selectWorkspace(ws.path);
    });

    // Wait for UI to settle and skip onboarding if present
    await page.waitForTimeout(1000);
    const onboardingModal = page.locator('[data-testid="onboarding-modal"]');
    if (await onboardingModal.count() > 0) {
      await page.getByRole('button', { name: '跳过引导' }).click();
      await expect(onboardingModal).toHaveCount(0, { timeout: 5_000 });
    }

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    // Enable plan mode via Agent mode menu
    const modeTrigger = page.getByRole('button', { name: '选择 Agent 模式' });
    await expect(modeTrigger).toBeVisible();
    await modeTrigger.click();
    const modeMenu = page.getByRole('menu', { name: 'Agent 模式' });
    await expect(modeMenu).toBeVisible();
    await modeMenu.getByRole('menuitemradio', { name: /Plan/ }).click();
    await expect(modeTrigger).toContainText('Plan');

    // Send a project exploration request. This is concrete enough to plan from
    // read-only repo exploration, so it should not be blocked by local guidance.
    await textarea.fill('了解一下这个项目');
    await textarea.press('Enter');

    await expect(page.getByText('计划模式需要目标')).toHaveCount(0);

    // Verify the renderer sends the plain user request; plan mode session switching is covered elsewhere.
    await expect.poll(async () => {
      const calls = await app.evaluate(() => {
        const target = globalThis as typeof globalThis & { __promptCalls?: Array<{ message: string }> };
        return target.__promptCalls ?? [];
      });
      return calls.length;
    }, { timeout: 15_000 }).toBe(1);

    const sentMessage = await app.evaluate(() => {
      const target = globalThis as typeof globalThis & { __promptCalls?: Array<{ message: string }> };
      return target.__promptCalls?.[0]?.message ?? '';
    });

    expect(sentMessage).toBe('了解一下这个项目');
  });
});

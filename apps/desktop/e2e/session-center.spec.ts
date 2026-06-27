/**
 * Session History Entry Tests — Pi Desktop 当前会话历史入口
 *
 * 覆盖:
 *   1. 当前历史搜索覆盖层入口
 *   2. 创建新会话
 *   3. 切换会话
 *   4. 会话搜索
 */
import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { join } from 'path';
import { mkdirSync } from 'fs';

const TEST_TIMEOUT = 60_000;
const ACCEPTANCE_DIR = join(__dirname, "..", "..", "..", "docs", "compose", "acceptance");

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const app = await _electron.launch({
        executablePath: resolveElectronExecutablePath(),
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: { ...process.env, CI: '1', ELECTRON_RENDERER_URL: '' },
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    const modalCount = await page.locator('[data-testid="onboarding-modal"]').count();
    if (modalCount > 0) {
        await page.getByRole('button', { name: '跳过引导' }).click({ timeout: 5000 });
        await page.waitForFunction(
            () => document.querySelector('[data-testid="onboarding-modal"]') === null,
            { timeout: 5000 }
        );
    }
    return { app, page };
}

test.describe('Pi Desktop — Session History Entry', () => {
    test.setTimeout(TEST_TIMEOUT);

    test('open-sessions entrypoint now restores the real session center surface', async () => {
        mkdirSync(ACCEPTANCE_DIR, { recursive: true });
        const userDataDir = test.info().outputPath(`session-ui-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        await page.evaluate(() => {
            window.dispatchEvent(new CustomEvent("slash-command:open-sessions"));
        });
        await expect(page.getByRole('heading', { name: '会话中心' })).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole('button', { name: '批量导出' })).toBeVisible();
        await expect(page.getByRole('textbox', { name: '搜索会话' })).toBeVisible();
        await page.getByRole('button', { name: '批量导出' }).click();
        await expect(page.getByRole('heading', { name: '导出会话' })).toBeVisible({ timeout: 5000 });
        await page.screenshot({
            path: join(ACCEPTANCE_DIR, "2026-06-26-session-center-restored.png"),
            fullPage: true,
        });

        await app.close();
    });

    test('session IPC: create + list + delete', async () => {
        const userDataDir = test.info().outputPath(`session-lifecycle-${Date.now()}`);
        const wsPath = join(userDataDir, 'workspace');
        const { app, page } = await launchApp(userDataDir);

        // Create workspace
        const ws = await page.evaluate(async ({ wsPath }) => {
            return await window.piAPI.createWorkspace('session-test', wsPath);
        }, { wsPath });
        expect(ws).toBeTruthy();

        // Create sessions
        const sessions = await page.evaluate(async () => {
            const workspaces = await window.piAPI.listWorkspaces();
            const ws = workspaces[0];
            if (!ws) return [];

            const s1 = await window.piAPI.createSession(ws.id, 'Session A', 'session-a');
            const s2 = await window.piAPI.createSession(ws.id, 'Session B', 'session-b');

            const list = await window.piAPI.listSessions();
            return list.map((s: { id: string; title: string }) => ({ id: s.id, title: s.title }));
        });

        expect(sessions.length).toBeGreaterThanOrEqual(2);
        const titles = sessions.map((s: { title: string }) => s.title);
        expect(titles).toContain('Session A');
        expect(titles).toContain('Session B');

        console.log(`[TEST] Sessions: ${titles.join(', ')}`);

        // Delete one session
        await page.evaluate(async () => {
            await window.piAPI.deleteSession('session-a');
            return await window.piAPI.listSessions();
        });

        const afterDelete = await page.evaluate(async () => {
            const list = await window.piAPI.listSessions();
            return list.map((s: { id: string; title: string }) => ({ id: s.id, title: s.title }));
        });

        const afterTitles = afterDelete.map((s: { title: string }) => s.title);
        expect(afterTitles).not.toContain('Session A');
        expect(afterTitles).toContain('Session B');

        console.log(`[TEST] After delete: ${afterTitles.join(', ')}`);

        await app.close();
    });
});

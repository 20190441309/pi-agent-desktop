/**
 * Interactive Demo: Automated clicks through Pi Desktop UI
 * This spec launches the Electron app and automatically performs
 * a series of UI interactions (clicks, inputs, screenshots).
 */
import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { join } from 'path';
import { mkdirSync } from 'fs';
import { getWindowByUrl, hideSettingsWindow, showSettingsWindow } from "./support/electron-windows";

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
    const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const app = await _electron.launch({
        executablePath: resolveElectronExecutablePath(),
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: { ...process.env, CI: '1', ELECTRON_RENDERER_URL: '' },
    });
    await getWindowByUrl(app, "index.html");
    const page = await getWindowByUrl(app, 'index.html');

    // Skip onboarding if present
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

test.describe('Pi Desktop — Interactive Automated Demo', () => {
    let app: ElectronApplication;
    let page: Page;
    const screenshotDir = join(__dirname, '..', 'e2e-output', 'interactive-demo');

    test.beforeAll(() => {
        mkdirSync(screenshotDir, { recursive: true });
    });

    test.afterEach(async () => {
        try { await app?.close(); } catch { /* ignore */ }
    });

    test('auto-navigates through all major UI sections with screenshots', async () => {
        ({ app, page } = await launchApp());
        const workspacePath = test.info().outputPath('interactive-demo-workspace');
        await page.evaluate(async (path) => {
            window.localStorage.setItem('pi-desktop:firstLaunchDone', 'true');
            window.localStorage.setItem('pi-desktop.onboarding.completed', 'true');
            const ws = await window.piAPI.createWorkspace('interactive-demo', path);
            await window.piAPI.selectWorkspace(ws.path);
        }, workspacePath);
        await page.reload({ waitUntil: 'domcontentloaded' });

        // ===== Step 1: Initial launch screenshot =====
        await page.screenshot({ path: join(screenshotDir, '01-initial-launch.png') });
        console.log('[AUTO] Screenshot 01: Initial launch captured');

        // ===== Step 2: Open the conversation surface =====
        const chatTab = page.getByRole('tab', { name: '对话' });
        await expect(chatTab).toBeVisible({ timeout: 5000 });
        await chatTab.click();
        await expect(page.locator('textarea[aria-label="发送"]')).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(screenshotDir, '02-after-click-new-task.png') });
        console.log('[AUTO] Opened conversation surface');

        // ===== Step 3: Click "任务" =====
        await page.getByRole('tab', { name: '运行' }).click();
        const tasksTab = page.getByRole('tab', { name: '任务' });
        await expect(tasksTab).toBeVisible({ timeout: 5000 });
        await tasksTab.click();
        await expect(page.getByText('任务总览')).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(screenshotDir, '03-after-click-tasks.png') });
        console.log('[AUTO] Clicked "任务"');

        // ===== Step 4: Click "工具" =====
        const skillsBtn = page.getByRole('tab', { name: '扩展' });
        await expect(skillsBtn).toBeVisible({ timeout: 5000 });
        await skillsBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(screenshotDir, '04-after-click-skills.png') });
        console.log('[AUTO] Clicked "插件" (Skills)');

        // Click "+ 创建" dropdown inside skills panel
        const createBtn = page.getByRole('button', { name: /\+ 创建/ });
        if (await createBtn.isVisible().catch(() => false)) {
            await createBtn.click();
            await page.waitForTimeout(400);
            await page.screenshot({ path: join(screenshotDir, '04b-skills-create-dropdown.png') });
            console.log('[AUTO] Clicked "+ 创建" dropdown in Skills panel');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
        }

        // ===== Step 5: Click "记忆" =====
        await page.getByRole('tab', { name: '运行' }).click();
        const memoryBtn = page.getByRole('tab', { name: '记忆' });
        await expect(memoryBtn).toBeVisible({ timeout: 5000 });
        await memoryBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(screenshotDir, '05-after-click-memory.png') });
        console.log('[AUTO] Clicked "记忆"');

        // ===== Step 6: Click "设置" (Settings) — opens window =====
        const settingsBtn = page.getByRole('button', { name: '打开设置' });
        await expect(settingsBtn).toBeVisible({ timeout: 5000 });
        const settingsWindow = await showSettingsWindow(app, page);
        await expect(settingsWindow.getByRole('tablist', { name: '设置分类' })).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(400);
        await settingsWindow.screenshot({ path: join(screenshotDir, '06-after-click-settings.png') });
        console.log('[AUTO] Clicked "设置" (Settings) — window opened');

        // Switch a few Settings tabs (first 3)
        const tabs = settingsWindow.locator('[role="tab"]');
        const tabCount = await tabs.count();
        for (let i = 1; i < Math.min(tabCount, 4); i++) {
            await tabs.nth(i).click();
            await settingsWindow.waitForTimeout(300);
            await settingsWindow.screenshot({ path: join(screenshotDir, `06b-settings-tab-${i}.png`) });
            console.log(`[AUTO] Settings tab ${i} clicked`);
        }

        await hideSettingsWindow(app, settingsWindow);
        await page.bringToFront();
        await page.screenshot({ path: join(screenshotDir, '06c-after-close-settings.png') });
        console.log('[AUTO] Closed Settings window');

        // ===== Step 7: Open Command Palette with Ctrl+K =====
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(screenshotDir, '07-command-palette-open.png') });
        console.log('[AUTO] Opened Command Palette (Ctrl+K)');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);

        // ===== Step 8: Click Agent mode trigger =====
        const modeTrigger = page.getByRole('button', { name: '选择 Agent 模式' });
        if (await modeTrigger.isVisible().catch(() => false)) {
            await modeTrigger.click();
            await page.waitForTimeout(400);
            await page.screenshot({ path: join(screenshotDir, '08-agent-mode-menu-open.png') });
            console.log('[AUTO] Clicked Agent mode trigger');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
        }

        // ===== Step 9: Click model trigger =====
        const modelTrigger = page.getByRole('button', { name: /当前模型:/ });
        if (await modelTrigger.isVisible().catch(() => false)) {
            await modelTrigger.click();
            await page.waitForTimeout(400);
            await page.screenshot({ path: join(screenshotDir, '09-model-menu-open.png') });
            console.log('[AUTO] Clicked model trigger');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
        }

        // ===== Step 10: Final screenshot — back to new task view =====
        await chatTab.click();
        await expect(page.locator('textarea[aria-label="发送"]')).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(screenshotDir, '10-final-state.png') });
        console.log('[AUTO] Final screenshot captured');

        console.log('[AUTO] === All automated interactions completed ===');
        console.log(`[AUTO] Screenshots saved to: ${screenshotDir}`);
    });
});

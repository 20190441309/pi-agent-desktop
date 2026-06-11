/**
 * Interactive Demo: Automated clicks through Pi Desktop UI
 * This spec launches the Electron app and automatically performs
 * a series of UI interactions (clicks, inputs, screenshots).
 */
import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';
import { join } from 'path';
import { mkdirSync } from 'fs';

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
    const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const app = await _electron.launch({
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: { ...process.env, CI: '1', ELECTRON_RENDERER_URL: '' },
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

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

        // ===== Step 1: Initial launch screenshot =====
        await page.screenshot({ path: join(screenshotDir, '01-initial-launch.png') });
        console.log('[AUTO] Screenshot 01: Initial launch captured');

        // ===== Step 2: Click "新建任务" (New Task) =====
        const newTaskBtn = page.locator('button[data-mmcode-section="new-task"]');
        await expect(newTaskBtn).toBeVisible({ timeout: 5000 });
        await newTaskBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(screenshotDir, '02-after-click-new-task.png') });
        console.log('[AUTO] Clicked "新建任务" (New Task)');

        // ===== Step 3: Click "文件" (Files) =====
        const filesBtn = page.locator('button[data-mmcode-section="files"]');
        await expect(filesBtn).toBeVisible({ timeout: 5000 });
        await filesBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(screenshotDir, '03-after-click-files.png') });
        console.log('[AUTO] Clicked "文件" (Files)');

        // ===== Step 4: Click "插件" (Skills/Plugins) =====
        const skillsBtn = page.locator('button[data-mmcode-section="skills"]');
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

        // ===== Step 5: Click "Git" =====
        const gitBtn = page.locator('button[data-mmcode-section="git"]');
        await expect(gitBtn).toBeVisible({ timeout: 5000 });
        await gitBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(screenshotDir, '05-after-click-git.png') });
        console.log('[AUTO] Clicked "Git"');

        // ===== Step 6: Click "设置" (Settings) — opens dialog =====
        const settingsBtn = page.locator('button[data-mmcode-section="settings"]');
        await expect(settingsBtn).toBeVisible({ timeout: 5000 });
        await settingsBtn.click();
        const settingsDialog = page.getByRole('dialog', { name: '设置' });
        await expect(settingsDialog).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(screenshotDir, '06-after-click-settings.png') });
        console.log('[AUTO] Clicked "设置" (Settings) — dialog opened');

        // Switch a few Settings tabs (first 3)
        const tabs = settingsDialog.locator('[role="tab"]');
        const tabCount = await tabs.count();
        for (let i = 1; i < Math.min(tabCount, 4); i++) {
            await tabs.nth(i).click();
            await page.waitForTimeout(300);
            await page.screenshot({ path: join(screenshotDir, `06b-settings-tab-${i}.png`) });
            console.log(`[AUTO] Settings tab ${i} clicked`);
        }

        // Close settings dialog using the close button
        const closeBtn = settingsDialog.locator('button[aria-label="关闭"]').first();
        await closeBtn.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(screenshotDir, '06c-after-close-settings.png') });
        console.log('[AUTO] Closed Settings dialog');

        // ===== Step 7: Open Command Palette with Ctrl+K =====
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(screenshotDir, '07-command-palette-open.png') });
        console.log('[AUTO] Opened Command Palette (Ctrl+K)');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);

        // ===== Step 8: Click permission trigger =====
        const permTrigger = page.locator('[data-testid="chat-input-permission-trigger"]');
        if (await permTrigger.isVisible().catch(() => false)) {
            await permTrigger.click();
            await page.waitForTimeout(400);
            await page.screenshot({ path: join(screenshotDir, '08-permission-menu-open.png') });
            console.log('[AUTO] Clicked permission trigger');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
        }

        // ===== Step 9: Click model trigger =====
        const modelTrigger = page.locator('[data-testid="chat-input-model-trigger"]');
        if (await modelTrigger.isVisible().catch(() => false)) {
            await modelTrigger.click();
            await page.waitForTimeout(400);
            await page.screenshot({ path: join(screenshotDir, '09-model-menu-open.png') });
            console.log('[AUTO] Clicked model trigger');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
        }

        // ===== Step 10: Final screenshot — back to new task view =====
        await newTaskBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(screenshotDir, '10-final-state.png') });
        console.log('[AUTO] Final screenshot captured');

        console.log('[AUTO] === All automated interactions completed ===');
        console.log(`[AUTO] Screenshots saved to: ${screenshotDir}`);
    });
});

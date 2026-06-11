/**
 * Terminal & Tools Tests — Pi Desktop 终端与工具集成
 */
import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';
import { join } from 'path';

const TEST_TIMEOUT = 60_000;

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const app = await _electron.launch({
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: { ...process.env, CI: '1', ELECTRON_RENDERER_URL: '' },
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // Skip onboarding
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

test.describe('Pi Desktop — Terminal & Tools', () => {
    test.setTimeout(TEST_TIMEOUT);

    test('shortcuts cheatsheet opens and closes', async () => {
        const userDataDir = test.info().outputPath(`cheatsheet-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        await page.keyboard.press('Shift+?');
        await page.waitForTimeout(500);

        const cheatsheet = page.getByRole('dialog').filter({ hasText: '快捷键' });
        await expect(cheatsheet).toBeVisible({ timeout: 3000 });

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await expect(cheatsheet).toBeHidden({ timeout: 3000 });

        await app.close();
    });

    test('settings dialog opens and all tabs clickable', async () => {
        const userDataDir = test.info().outputPath(`settings-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        // Click settings button
        await page.locator('button[data-mmcode-section="settings"]').click();
        const dialog = page.getByRole('dialog', { name: '设置' });
        await expect(dialog).toBeVisible({ timeout: 3000 });

        // Get tabs
        const tabs = dialog.locator('[role="tab"]');
        const tabCount = await tabs.count();
        expect(tabCount).toBeGreaterThanOrEqual(1);
        console.log(`[TEST] Settings has ${tabCount} tabs`);

        // Click each tab
        for (let i = 0; i < tabCount; i++) {
            await tabs.nth(i).click();
            await page.waitForTimeout(200);
            await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true');
        }

        // Close
        const closeBtn = dialog.locator('button[aria-label="关闭"]').first();
        await closeBtn.click();
        await page.waitForTimeout(300);

        await app.close();
    });
});

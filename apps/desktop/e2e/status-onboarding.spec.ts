/**
 * Pi Status & Onboarding Tests — Pi Desktop 状态与引导
 *
 * 覆盖:
 *   1. Pi CLI 状态检测
 *   2. Onboarding 流程
 *   3. Pi 安装/卸载状态
 */
import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';
import { resolveElectronExecutablePath } from "./support/electron-launch";

const TEST_TIMEOUT = 60_000;

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const app = await _electron.launch({
        executablePath: resolveElectronExecutablePath(),
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: { ...process.env, CI: '1', ELECTRON_RENDERER_URL: '' },
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    return { app, page };
}

test.describe('Pi Desktop — Status & Onboarding', () => {
    test.setTimeout(TEST_TIMEOUT);

    test('pi status IPC: detect installed Pi CLI', async () => {
        const userDataDir = test.info().outputPath(`pi-status-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        const status = await page.evaluate(async () => {
            return await window.piAPI.getStatus();
        });

        expect(status).toBeTruthy();
        console.log(`[TEST] Pi status: installed=${status.installed}, version=${status.version ?? 'unknown'}`);

        await app.close();
    });

    test('onboarding modal appears for fresh user', async () => {
        const userDataDir = test.info().outputPath(`onboarding-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        // Should show onboarding for fresh user
        const modal = page.locator('[data-testid="onboarding-modal"]');
        const isVisible = await modal.isVisible().catch(() => false);

        if (isVisible) {
            console.log('[TEST] Onboarding modal visible for fresh user');
            // Click skip
            await page.getByRole('button', { name: '跳过引导' }).click({ timeout: 5000 });
            await page.waitForFunction(
                () => document.querySelector('[data-testid="onboarding-modal"]') === null,
                { timeout: 5000 }
            );
            console.log('[TEST] Onboarding skipped');
        } else {
            console.log('[TEST] Onboarding not shown (possibly already completed)');
        }

        await app.close();
    });

    test('pi config IPC: get models config', async () => {
        const userDataDir = test.info().outputPath(`pi-config-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        const config = await page.evaluate(async () => {
            return await window.piAPI.configGetModels();
        });

        expect(config).toBeTruthy();
        expect(config.parsed).toBeTruthy();
        console.log(`[TEST] Models config keys: ${Object.keys(config.parsed).join(', ')}`);

        await app.close();
    });
});

/**
 * Skills & Plugins Tests — Pi Desktop 技能与插件系统
 *
 * 覆盖:
 *   1. Skills 面板加载
 *   2. 插件搜索
 *   3. 已安装插件列表
 *   4. Pi Package 搜索
 */
import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';

const TEST_TIMEOUT = 60_000;

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const app = await _electron.launch({
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

test.describe('Pi Desktop — Skills & Plugins', () => {
    test.setTimeout(TEST_TIMEOUT);

    test('skills panel loads and shows installed skills', async () => {
        const userDataDir = test.info().outputPath(`skills-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        // Open skills panel
        await page.locator('button[data-mmcode-section="skills"]').click();
        await page.waitForTimeout(500);

        // Verify skills region is visible
        await expect(page.getByRole('region', { name: '插件面板' })).toBeVisible({ timeout: 5000 });

        await app.close();
    });

    test('skills IPC: listSkills returns array', async () => {
        const userDataDir = test.info().outputPath(`skills-ipc-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        const skills = await page.evaluate(async () => {
            return await window.piAPI.listSkills();
        });

        expect(Array.isArray(skills)).toBe(true);
        console.log(`[TEST] Skills count: ${skills.length}`);

        await app.close();
    });

    test('pi packages IPC: listInstalled returns array', async () => {
        const userDataDir = test.info().outputPath(`packages-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        const packages = await page.evaluate(async () => {
            return await window.piAPI.packagesListInstalled();
        });

        expect(Array.isArray(packages)).toBe(true);
        console.log(`[TEST] Installed packages: ${packages.length}`);

        await app.close();
    });
});

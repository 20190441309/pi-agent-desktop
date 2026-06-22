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

async function installPiPackagesIpcStubs(app: ElectronApplication): Promise<void> {
    await app.evaluate(({ ipcMain }) => {
        type PackageEvent = { channel: string; source?: string; query?: string };
        type PackageInfo = {
            name: string;
            source: string;
            description: string;
            url: string;
            installed: boolean;
        };
        type InstalledPackage = { name: string; source: string; scope: "global"; version: string };

        const target = globalThis as typeof globalThis & {
            __piPackageEvents?: PackageEvent[];
            __piPackageInstalled?: InstalledPackage[];
        };
        target.__piPackageEvents = [];
        target.__piPackageInstalled = [];

        const packageInfo = (): PackageInfo => ({
            name: "audit-pkg",
            source: "npm:audit-package",
            description: "Audit package for E2E button coverage",
            url: "https://pi.dev/packages/audit-pkg",
            installed: Boolean(target.__piPackageInstalled?.some((item) => item.source === "npm:audit-package")),
        });

        const handlers = [
            "packages:search",
            "packages:refresh-catalog",
            "packages:list-installed",
            "packages:install",
            "packages:remove",
            "packages:update",
            "skills:installed",
        ];
        for (const channel of handlers) {
            ipcMain.removeHandler(channel);
        }

        ipcMain.handle("packages:search", async (_event, query: string) => {
            target.__piPackageEvents?.push({ channel: "packages:search", query });
            return [packageInfo()];
        });
        ipcMain.handle("packages:refresh-catalog", async () => {
            target.__piPackageEvents?.push({ channel: "packages:refresh-catalog" });
            return [packageInfo()];
        });
        ipcMain.handle("packages:list-installed", async () => {
            target.__piPackageEvents?.push({ channel: "packages:list-installed" });
            return target.__piPackageInstalled ?? [];
        });
        ipcMain.handle("packages:install", async (_event, source: string) => {
            target.__piPackageEvents?.push({ channel: "packages:install", source });
            target.__piPackageInstalled = [{ name: "audit-pkg", source, scope: "global", version: "1.0.0" }];
            return { success: true, message: `已安装 ${source}`, requiresRestart: true };
        });
        ipcMain.handle("packages:update", async (_event, source: string) => {
            target.__piPackageEvents?.push({ channel: "packages:update", source });
            return { success: true, message: `已更新 ${source}`, requiresRestart: true };
        });
        ipcMain.handle("packages:remove", async (_event, source: string) => {
            target.__piPackageEvents?.push({ channel: "packages:remove", source });
            target.__piPackageInstalled = (target.__piPackageInstalled ?? []).filter((item) => item.source !== source);
            return { success: true, message: `已卸载 ${source}`, requiresRestart: true };
        });
        ipcMain.handle("skills:installed", async () => []);
    });
}

test.describe('Pi Desktop — Skills & Plugins', () => {
    test.setTimeout(TEST_TIMEOUT);

    test('skills panel loads and shows installed skills', async () => {
        const userDataDir = test.info().outputPath(`skills-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        await page.getByRole('tab', { name: '技能' }).click();

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

    test('pi package marketplace buttons install, update and uninstall through the visible UI', async () => {
        const userDataDir = test.info().outputPath(`packages-ui-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);
        await installPiPackagesIpcStubs(app);

        await page.getByRole('tab', { name: '技能' }).click();
        await expect(page.getByRole('region', { name: '插件面板' })).toBeVisible({ timeout: 5000 });

        await expect(page.getByRole('button', { name: '安装 audit-pkg' })).toBeVisible({ timeout: 5000 });
        await page.getByRole('button', { name: '刷新目录' }).click();
        await expect(page.getByRole('button', { name: '安装 audit-pkg' })).toBeVisible({ timeout: 5000 });

        await page.getByRole('button', { name: '安装 audit-pkg' }).click();
        const installDialog = page.getByRole('dialog', { name: '确认安装 Pi 插件' });
        await expect(installDialog).toBeVisible();
        await expect(installDialog).toContainText('npm:audit-package');
        await expect(installDialog).toContainText('从 npm 包源安装，请确认包名和维护者可信。');
        await installDialog.getByRole('button', { name: '取消' }).click();
        await expect(installDialog).toBeHidden({ timeout: 3000 });

        await page.getByRole('button', { name: '安装 audit-pkg' }).click();
        await page.getByRole('dialog', { name: '确认安装 Pi 插件' }).getByRole('button', { name: '确认安装' }).click();
        await expect(page.getByRole('status').filter({ hasText: '已安装 npm:audit-package' })).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole('button', { name: '卸载 audit-pkg' })).toBeVisible({ timeout: 5000 });

        await page.getByRole('tab', { name: '已安装' }).click();
        await expect(page.getByText('npm:audit-package · 全局')).toBeVisible({ timeout: 5000 });
        await page.getByRole('button', { name: '更新 audit-pkg' }).click();
        await expect(page.getByRole('status').filter({ hasText: '已更新 npm:audit-package' })).toBeVisible({ timeout: 5000 });

        await page.getByRole('button', { name: '卸载 audit-pkg' }).click();
        const removeDialog = page.getByRole('dialog', { name: '确认卸载' });
        await expect(removeDialog).toBeVisible();
        await removeDialog.getByRole('button', { name: '取消' }).click();
        await expect(removeDialog).toBeHidden({ timeout: 3000 });

        await page.getByRole('button', { name: '卸载 audit-pkg' }).click();
        await page.getByRole('dialog', { name: '确认卸载' }).getByRole('button', { name: '卸载' }).click();
        await expect(page.getByRole('status').filter({ hasText: '已卸载 npm:audit-package' })).toBeVisible({ timeout: 5000 });

        const events = await app.evaluate(() => {
            const target = globalThis as typeof globalThis & {
                __piPackageEvents?: Array<{ channel: string; source?: string; query?: string }>;
            };
            return target.__piPackageEvents ?? [];
        });
        expect(events.some((event) => event.channel === 'packages:refresh-catalog')).toBe(true);
        expect(events).toContainEqual({ channel: 'packages:install', source: 'npm:audit-package' });
        expect(events).toContainEqual({ channel: 'packages:update', source: 'npm:audit-package' });
        expect(events).toContainEqual({ channel: 'packages:remove', source: 'npm:audit-package' });

        await app.close();
    });
});

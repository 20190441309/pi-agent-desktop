import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { join } from "path";
import { electronMainEntry } from "../playwright.config";
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { getWindowByUrl } from "./support/electron-windows";

const ACCEPTANCE_DIR = join(__dirname, "..", "..", "..", "docs", "compose", "acceptance");

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const app = await _electron.launch({
        executablePath: resolveElectronExecutablePath(),
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: { ...process.env, CI: "1", ELECTRON_RENDERER_URL: "" },
    });
    const page = await getWindowByUrl(app, "index.html");
    await page.waitForLoadState("domcontentloaded");

    const modal = page.locator("[data-testid=\"onboarding-modal\"]");
    if (await modal.count()) {
        await page.getByRole("button", { name: "跳过引导" }).click();
        await expect(modal).toHaveCount(0, { timeout: 5_000 });
    }

    return { app, page };
}

async function windowMetrics(
    app: ElectronApplication,
    urlPart: string,
): Promise<{ bounds: { x: number; y: number; width: number; height: number }; minSize: [number, number] }> {
    return app.evaluate(({ BrowserWindow }, target) => {
        const win = BrowserWindow.getAllWindows().find((item) => {
            try {
                return !item.isDestroyed() && item.webContents.getURL().includes(target);
            } catch {
                return false;
            }
        });
        if (!win) {
            throw new Error(`Window not found: ${target}`);
        }
        return {
            bounds: win.getBounds(),
            minSize: win.getMinimumSize(),
        };
    }, urlPart);
}

test.describe("Pi Desktop window geometry", () => {
    let app: ElectronApplication;

    test.afterEach(async () => {
        try {
            await app?.close();
        } catch {
            // ignore teardown failures
        }
    });

    test("main and settings windows use the enlarged B-layout geometry", async () => {
        const userDataDir = test.info().outputPath(`window-geometry-${Date.now()}`);
        const launched = await launchApp(userDataDir);
        app = launched.app;
        const page = launched.page;

        const topTabs = page.getByRole("tablist", { name: "顶部标签栏" }).getByRole("tab");
        await expect(topTabs).toHaveCount(4, { timeout: 30_000 });
        await expect(page.getByRole("tab", { name: "对话" })).toBeVisible({ timeout: 10_000 });

        const mainWindow = await windowMetrics(app, "index.html");
        expect(Math.abs(mainWindow.bounds.width - 896)).toBeLessThanOrEqual(1);
        expect(Math.abs(mainWindow.bounds.height - 756)).toBeLessThanOrEqual(1);
        expect(mainWindow.minSize).toEqual([896, 756]);
        await page.screenshot({ path: join(ACCEPTANCE_DIR, "2026-07-02-window-geometry-main.png"), fullPage: true });

        const settingsWindowPromise = app.waitForEvent("window");
        await page.getByRole("button", { name: "打开设置" }).click();
        const settingsWindow = await settingsWindowPromise;
        await settingsWindow.waitForLoadState("domcontentloaded");
        await expect(settingsWindow.getByRole("tablist", { name: "设置分类" })).toBeVisible({ timeout: 10_000 });

        const settingsMetrics = await windowMetrics(app, "settings.html");
        expect(Math.abs(settingsMetrics.bounds.width - 1067)).toBeLessThanOrEqual(1);
        expect(Math.abs(settingsMetrics.bounds.height - 800)).toBeLessThanOrEqual(1);
        expect(settingsMetrics.minSize).toEqual([960, 694]);

        const expectedX = mainWindow.bounds.x + Math.round((mainWindow.bounds.width - settingsMetrics.bounds.width) / 2);
        const expectedY = mainWindow.bounds.y + Math.round((mainWindow.bounds.height - settingsMetrics.bounds.height) / 2);
        expect(Math.abs(settingsMetrics.bounds.x - expectedX)).toBeLessThanOrEqual(2);
        expect(Math.abs(settingsMetrics.bounds.y - expectedY)).toBeLessThanOrEqual(2);
        await settingsWindow.screenshot({ path: join(ACCEPTANCE_DIR, "2026-07-02-window-geometry-settings.png"), fullPage: true });
    });
});

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

    test("records current DPI scale and shell paint baseline (A-014/K-012/K-013 smoke)", async () => {
        // Full multi-DPI (100/125/150/200) still needs a host matrix; this captures the host scale + timing smoke.
        const userDataDir = test.info().outputPath(`window-dpi-smoke-${Date.now()}`);
        const started = Date.now();
        const launched = await launchApp(userDataDir);
        app = launched.app;
        const page = launched.page;

        await expect(page.getByRole("tablist", { name: "顶部标签栏" })).toBeVisible({ timeout: 30_000 });
        const metrics = await page.evaluate(() => {
            const tablist = document.querySelector('[role="tablist"][aria-label="顶部标签栏"]');
            const rect = tablist?.getBoundingClientRect();
            return {
                devicePixelRatio: window.devicePixelRatio,
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                tablistWidth: rect?.width ?? 0,
                tablistHeight: rect?.height ?? 0,
                overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
            };
        });

        // Host scale is observed, not forced — multi-scale harness remains manual residual.
        expect(metrics.devicePixelRatio).toBeGreaterThan(0);
        expect(metrics.innerWidth).toBeGreaterThan(800);
        expect(metrics.innerHeight).toBeGreaterThan(600);
        expect(metrics.tablistWidth).toBeGreaterThan(100);
        expect(metrics.tablistHeight).toBeGreaterThan(20);
        expect(metrics.overflowX).toBe(false);

        const coldStartMs = Date.now() - started;
        // Soft budget for CI/dev hosts; not a formal perf gate.
        expect(coldStartMs).toBeLessThan(90_000);
        console.log(
            `[TEST] DPI smoke dpr=${metrics.devicePixelRatio} size=${metrics.innerWidth}x${metrics.innerHeight} coldStartMs=${coldStartMs}`,
        );
    });

    for (const scale of [1, 1.25, 1.5, 2] as const) {
        test(`forced device scale factor ${scale} keeps shell usable (A-014/K-012)`, async () => {
            // Electron can force DPR for reproducible multi-DPI without OS display changes.
            // Does not replace a physical multi-monitor lab, but covers 100/125/150/200 logical scales.
            const userDataDir = test.info().outputPath(`window-dpi-scale-${String(scale).replace(".", "_")}-${Date.now()}`);
            const launchedApp = await _electron.launch({
                executablePath: resolveElectronExecutablePath(),
                args: [
                    `--force-device-scale-factor=${scale}`,
                    `--user-data-dir=${userDataDir}`,
                    electronMainEntry,
                ],
                env: { ...process.env, CI: "1", ELECTRON_RENDERER_URL: "" },
            });
            app = launchedApp;
            const page = await getWindowByUrl(app, "index.html");
            await page.waitForLoadState("domcontentloaded");
            const modal = page.locator("[data-testid=\"onboarding-modal\"]");
            if (await modal.count()) {
                await page.getByRole("button", { name: "跳过引导" }).click();
                await expect(modal).toHaveCount(0, { timeout: 5_000 });
            }

            await expect(page.getByRole("tablist", { name: "顶部标签栏" })).toBeVisible({ timeout: 30_000 });
            await expect(page.getByRole("tab", { name: "对话" })).toBeVisible();
            await expect(page.getByRole("button", { name: "打开设置" })).toBeVisible();

            const metrics = await page.evaluate(() => {
                const tablist = document.querySelector('[role="tablist"][aria-label="顶部标签栏"]');
                const rect = tablist?.getBoundingClientRect();
                const button = document.querySelector('[aria-label="打开设置"], button[title="打开设置"]')
                    ?? Array.from(document.querySelectorAll("button")).find((el) => el.textContent?.includes("设置") || el.getAttribute("aria-label")?.includes("设置"));
                const btnRect = button?.getBoundingClientRect();
                return {
                    devicePixelRatio: window.devicePixelRatio,
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight,
                    tablistWidth: rect?.width ?? 0,
                    tablistHeight: rect?.height ?? 0,
                    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
                    settingsButtonVisible: Boolean(btnRect && btnRect.width > 0 && btnRect.height > 0),
                };
            });

            // Allow slight host deviation from forced scale on some GPU drivers.
            expect(metrics.devicePixelRatio).toBeGreaterThan(0.9 * scale - 0.05);
            expect(metrics.innerWidth).toBeGreaterThan(700);
            expect(metrics.innerHeight).toBeGreaterThan(500);
            expect(metrics.tablistWidth).toBeGreaterThan(80);
            expect(metrics.tablistHeight).toBeGreaterThan(16);
            expect(metrics.overflowX).toBe(false);
            expect(metrics.settingsButtonVisible).toBe(true);

            await page.screenshot({
                path: test.info().outputPath(`dpi-scale-${String(scale).replace(".", "_")}.png`),
                fullPage: true,
            });
            console.log(
                `[TEST] forced scale=${scale} observedDpr=${metrics.devicePixelRatio} size=${metrics.innerWidth}x${metrics.innerHeight}`,
            );
        });
    }

    test("records structured cold-start perf baseline (K-013)", async () => {
        const userDataDir = test.info().outputPath(`window-perf-baseline-${Date.now()}`);
        const t0 = Date.now();
        const launched = await launchApp(userDataDir);
        app = launched.app;
        const page = launched.page;

        const shellVisibleAt = Date.now();
        await expect(page.getByRole("tablist", { name: "顶部标签栏" })).toBeVisible({ timeout: 30_000 });
        const firstPaintReadyAt = Date.now();

        // Lightweight interaction budget: open settings should not hang.
        const settingsStarted = Date.now();
        const settingsWindowPromise = app.waitForEvent("window");
        await page.getByRole("button", { name: "打开设置" }).click();
        const settingsWindow = await settingsWindowPromise;
        await settingsWindow.waitForLoadState("domcontentloaded");
        await expect(settingsWindow.getByRole("tablist", { name: "设置分类" })).toBeVisible({ timeout: 15_000 });
        const settingsReadyMs = Date.now() - settingsStarted;

        const baseline = {
            coldStartToDomMs: shellVisibleAt - t0,
            coldStartToShellMs: firstPaintReadyAt - t0,
            settingsOpenMs: settingsReadyMs,
            host: {
                platform: process.platform,
                dpr: await page.evaluate(() => window.devicePixelRatio),
            },
            budgetsMs: {
                coldStartToShell: 90_000,
                settingsOpen: 30_000,
            },
            recordedAt: new Date().toISOString(),
        };

        expect(baseline.coldStartToShellMs).toBeLessThan(baseline.budgetsMs.coldStartToShell);
        expect(baseline.settingsOpenMs).toBeLessThan(baseline.budgetsMs.settingsOpen);

        const { writeFileSync } = await import("node:fs");
        const outPath = test.info().outputPath("k013-perf-baseline.json");
        writeFileSync(outPath, JSON.stringify(baseline, null, 2), "utf8");
        console.log(`[TEST] K-013 perf baseline ${JSON.stringify(baseline)}`);
        await test.info().attach("k013-perf-baseline", {
            path: outPath,
            contentType: "application/json",
        });
    });
});

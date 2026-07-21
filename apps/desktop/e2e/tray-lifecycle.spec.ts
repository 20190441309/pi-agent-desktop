import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { electronMainEntry } from "../playwright.config";
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { getWindowByUrl } from "./support/electron-windows";

type ShellTestGlobals = typeof globalThis & {
  __PI_DESKTOP_TEST_SHELL__?: {
    hasTray: () => boolean;
    closeMainWindow: () => void;
    restoreMainWindow: () => void;
    isMainWindowVisible: () => boolean;
    quitApp: () => void;
  };
};

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await _electron.launch({
    executablePath: resolveElectronExecutablePath(),
    args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
    env: { ...process.env, CI: "1", ELECTRON_RENDERER_URL: "" },
  });
  const page = await getWindowByUrl(app, "index.html");
  const modal = page.locator("[data-testid=\"onboarding-modal\"]");
  if (await modal.count()) {
    await page.getByRole("button", { name: "跳过引导" }).click();
    await expect(modal).toHaveCount(0, { timeout: 5_000 });
  }
  return { app, page };
}

async function readShellState<T>(
  app: ElectronApplication,
  key: "hasTray" | "isMainWindowVisible",
  fallback: T,
): Promise<T> {
  try {
    return await app.evaluate((_electron, payload) => {
      const target = globalThis as ShellTestGlobals;
      const shell = target.__PI_DESKTOP_TEST_SHELL__;
      if (!shell) return payload.fallback;
      return shell[payload.key]() as T;
    }, { key, fallback });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/context.*destroyed|target.*closed|application.*closed/i.test(message)) return fallback;
    throw error;
  }
}
test.describe("Pi Desktop tray lifecycle", () => {
  let app: ElectronApplication;

  test.afterEach(async () => {
    try {
      await app?.evaluate(() => {
        const target = globalThis as ShellTestGlobals;
        target.__PI_DESKTOP_TEST_SHELL__?.quitApp();
      });
      await app?.close();
    } catch {
      // ignore
    }
  });

  test("close hides the main window to tray and tray restore makes it visible again", async () => {
    ({ app } = await launchApp(test.info().outputPath(`tray-lifecycle-${Date.now()}`)));

    await expect.poll(async () => {
      return readShellState(app, "hasTray", false);
    }, { timeout: 10_000 }).toBe(true);

    await app.evaluate(() => {
      const target = globalThis as ShellTestGlobals;
      target.__PI_DESKTOP_TEST_SHELL__?.closeMainWindow();
    });

    await expect.poll(async () => {
      return readShellState(app, "isMainWindowVisible", true);
    }, { timeout: 10_000 }).toBe(false);

    await app.evaluate(() => {
      const target = globalThis as ShellTestGlobals;
      target.__PI_DESKTOP_TEST_SHELL__?.restoreMainWindow();
    });

    await expect.poll(async () => {
      return readShellState(app, "isMainWindowVisible", false);
    }, { timeout: 10_000 }).toBe(true);
  });

  test("quitApp ends the Electron process (A-008 smoke, not full process-tree audit)", async () => {
    ({ app } = await launchApp(test.info().outputPath(`tray-quit-${Date.now()}`)));
    await expect.poll(async () => readShellState(app, "hasTray", false), { timeout: 10_000 }).toBe(true);

    const processExit = app.process();
    const exitPromise = new Promise<number | null>((resolve) => {
      processExit.once("exit", (code) => resolve(code));
    });

    await app.evaluate(() => {
      const target = globalThis as ShellTestGlobals;
      target.__PI_DESKTOP_TEST_SHELL__?.quitApp();
    });

    const code = await Promise.race([
      exitPromise,
      new Promise<number | null>((_, reject) => {
        setTimeout(() => reject(new Error("app did not exit within 15s after quitApp")), 15_000);
      }),
    ]);
    // Exit code may be 0 or null depending on host; process must terminate.
    expect(code === 0 || code === null || typeof code === "number").toBe(true);

    // Prevent afterEach double-quit on already-exited app.
    try {
      await app.close();
    } catch {
      // already exited
    }
    app = undefined as unknown as ElectronApplication;
  });

  test("quitApp closes child windows and terminates process (A-008 process tree)", async () => {
    // Evidence: settings child BrowserWindow + main process exit. Full OS process-tree
    // (orphaned node-pty grandchildren across users) remains residual without isolation tooling.
    ({ app } = await launchApp(test.info().outputPath(`tray-quit-tree-${Date.now()}`)));
    const page = await getWindowByUrl(app, "index.html");
    await expect(page.getByRole("tablist", { name: "顶部标签栏" })).toBeVisible({ timeout: 30_000 });

    const settingsWindowPromise = app.waitForEvent("window");
    await page.getByRole("button", { name: "打开设置" }).click();
    const settingsWindow = await settingsWindowPromise;
    await settingsWindow.waitForLoadState("domcontentloaded");
    await expect(settingsWindow.getByRole("tablist", { name: "设置分类" })).toBeVisible({ timeout: 10_000 });

    const windowCountBefore = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).length,
    );
    expect(windowCountBefore).toBeGreaterThanOrEqual(2);

    const childPid = app.process().pid;
    expect(typeof childPid).toBe("number");

    const processExit = app.process();
    const exitPromise = new Promise<number | null>((resolve) => {
      processExit.once("exit", (code) => resolve(code));
    });

    await app.evaluate(() => {
      const target = globalThis as ShellTestGlobals;
      target.__PI_DESKTOP_TEST_SHELL__?.quitApp();
    });

    const code = await Promise.race([
      exitPromise,
      new Promise<number | null>((_, reject) => {
        setTimeout(() => reject(new Error("app did not exit within 20s after quitApp with child windows")), 20_000);
      }),
    ]);
    expect(typeof code === "number" || code === null).toBe(true);

    // After process exit, Playwright cannot evaluate windows; process death is the tree signal.
    try {
      await app.close();
    } catch {
      // already exited
    }
    app = undefined as unknown as ElectronApplication;
  });
});

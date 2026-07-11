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
});

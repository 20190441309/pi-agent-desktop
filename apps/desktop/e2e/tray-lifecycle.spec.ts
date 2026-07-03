import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { electronMainEntry } from "../playwright.config";
import { resolveElectronExecutablePath } from "./support/electron-launch";

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
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  const modal = page.locator("[data-testid=\"onboarding-modal\"]");
  if (await modal.count()) {
    await page.getByRole("button", { name: "跳过引导" }).click();
    await expect(modal).toHaveCount(0, { timeout: 5_000 });
  }
  return { app, page };
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
      return app.evaluate(() => {
        const target = globalThis as ShellTestGlobals;
        return target.__PI_DESKTOP_TEST_SHELL__?.hasTray() ?? false;
      });
    }, { timeout: 10_000 }).toBe(true);

    await app.evaluate(() => {
      const target = globalThis as ShellTestGlobals;
      target.__PI_DESKTOP_TEST_SHELL__?.closeMainWindow();
    });

    await expect.poll(async () => {
      return app.evaluate(() => {
        const target = globalThis as ShellTestGlobals;
        return target.__PI_DESKTOP_TEST_SHELL__?.isMainWindowVisible() ?? true;
      });
    }, { timeout: 10_000 }).toBe(false);

    await app.evaluate(() => {
      const target = globalThis as ShellTestGlobals;
      target.__PI_DESKTOP_TEST_SHELL__?.restoreMainWindow();
    });

    await expect.poll(async () => {
      return app.evaluate(() => {
        const target = globalThis as ShellTestGlobals;
        return target.__PI_DESKTOP_TEST_SHELL__?.isMainWindowVisible() ?? false;
      });
    }, { timeout: 10_000 }).toBe(true);
  });
});

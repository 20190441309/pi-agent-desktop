import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";
import { electronMainEntry } from "../playwright.config";
import { resolveElectronExecutablePath } from "./support/electron-launch";

const ACCEPTANCE_DIR = join(__dirname, "..", "..", "..", "docs", "compose", "acceptance");

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

async function seedWorkspace(page: Page, workspacePath: string): Promise<void> {
  mkdirSync(workspacePath, { recursive: true });
  await page.evaluate(async (targetPath) => {
    const created = await window.piAPI.createWorkspace("draft-clear-e2e", targetPath);
    if (!created || !("id" in created)) {
      throw new Error("Failed to create draft-clear workspace");
    }
    await window.piAPI.selectWorkspace(targetPath);
  }, workspacePath);
}

test.describe("Pi Desktop draft clear", () => {
  let app: ElectronApplication;
  let page: Page;

  test.afterEach(async () => {
    try {
      await app?.evaluate(() => {
        const target = globalThis as {
          __PI_DESKTOP_TEST_SHELL__?: {
            quitApp: () => void;
          };
        };
        target.__PI_DESKTOP_TEST_SHELL__?.quitApp();
      });
      await app?.close();
    } catch {
      // ignore
    }
  });

  test("clears the composer immediately after Enter submit while the agent request is still pending", async () => {
    const userDataDir = test.info().outputPath(`draft-clear-${Date.now()}`);
    const workspacePath = test.info().outputPath("draft-clear-workspace");
    ({ app, page } = await launchApp(userDataDir));
    await seedWorkspace(page, workspacePath);
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    const textbox = page.getByRole("textbox");
    await expect(textbox).toBeVisible({ timeout: 15_000 });

    await page.evaluate(() => {
      const original = window.piAPI.agentsPrompt.bind(window.piAPI);
      window.piAPI.agentsPrompt = async (...args) => {
        void original;
        void args;
        return new Promise<void>(() => undefined);
      };
    });

    await textbox.fill("发送后输入框必须立刻清空");
    await textbox.press("Enter");

    await expect(
      page.getByTestId("chat-scroll-region").getByText("发送后输入框必须立刻清空"),
    ).toBeVisible({ timeout: 5_000 });
    await expect(textbox).toHaveValue("");
    await page.screenshot({ path: join(ACCEPTANCE_DIR, "2026-07-02-overlay-cluster-07-draft-cleared.png"), fullPage: true });
  });
});

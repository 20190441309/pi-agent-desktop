import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";
import { electronMainEntry } from "../playwright.config";
import { resolveElectronExecutablePath } from "./support/electron-launch";

const ACCEPTANCE_DIR = join(__dirname, "..", "..", "..", "docs", "compose", "acceptance");

type OverlayTestGlobals = typeof globalThis & {
  __PI_DESKTOP_TEST_OVERLAY__?: {
    emitPermissionRequest: (payload: {
      requestId: string;
      title: string;
      message?: string;
      workspaceId?: string;
      agentId?: string | null;
    }) => void;
  };
  __PI_DESKTOP_TEST_SHELL__?: {
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

async function seedWorkspace(page: Page, workspacePath: string): Promise<{ workspaceId: string }> {
  mkdirSync(workspacePath, { recursive: true });
  const workspaceId = await page.evaluate(async (targetPath) => {
    const created = await window.piAPI.createWorkspace("permission-more-e2e", targetPath);
    if (!created || !("id" in created)) {
      throw new Error("Failed to create permission-more workspace");
    }
    await window.piAPI.selectWorkspace(targetPath);
    return created.id;
  }, workspacePath);
  return { workspaceId };
}

async function emitPermissionRequest(
  app: ElectronApplication,
  request: { requestId: string; title: string; message?: string; workspaceId?: string; agentId?: string | null },
): Promise<void> {
  await app.evaluate((_electron, payload) => {
    const target = globalThis as OverlayTestGlobals;
    target.__PI_DESKTOP_TEST_OVERLAY__?.emitPermissionRequest(payload);
  }, request);
}

test.describe("Pi Desktop permission more menu", () => {
  let app: ElectronApplication;

  test.afterEach(async () => {
    try {
      await app?.evaluate(() => {
        const target = globalThis as OverlayTestGlobals;
        target.__PI_DESKTOP_TEST_SHELL__?.quitApp();
      });
      await app?.close();
    } catch {
      // ignore
    }
  });

  test("expands the more menu in the composer lane and allows clicking every decision", async () => {
    const userDataDir = test.info().outputPath(`permission-more-${Date.now()}`);
    const workspacePath = test.info().outputPath("permission-more-workspace");
    const launched = await launchApp(userDataDir);
    app = launched.app;
    const page = launched.page;
    const { workspaceId } = await seedWorkspace(page, workspacePath);
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("[data-testid=\"chat-input-shell\"]")).toBeVisible({ timeout: 15_000 });

    await emitPermissionRequest(app, {
      requestId: "permission_more_menu",
      workspaceId,
      title: "允许读取 package.json",
      message: "read package.json",
    });

    const dialog = page.getByRole("alertdialog", { name: "权限请求 1" });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "更多权限决策" }).click();
    await expect(page.getByRole("menuitem", { name: "允许一次" })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("menuitem", { name: "始终授权" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "拒绝本轮" })).toBeVisible();
    await page.screenshot({ path: join(ACCEPTANCE_DIR, "2026-07-02-overlay-cluster-04-more-menu.png"), fullPage: true });

    await page.getByRole("menuitem", { name: "允许一次" }).click();
    await expect(dialog).toHaveCount(0, { timeout: 5_000 });
  });
});

import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { electronMainEntry } from "../playwright.config";
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { join } from "path";

const ACCEPTANCE_DIR = join(__dirname, "..", "..", "..", "docs", "compose", "acceptance");

type RunningControlGlobals = typeof globalThis & {
  __runningControlPromptCalls?: Array<{ agentId: string; message: string; mode?: "build" | "plan" | "compose" }>;
  __runningControlAbortCalls?: string[];
  __testWorkspaces?: Array<{ id: string; name: string; path: string }>;
  __testCurrentWorkspace?: { id: string; name: string; path: string } | null;
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

async function installTestIpc(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }) => {
    const target = globalThis as RunningControlGlobals;
    target.__runningControlPromptCalls = [];
    target.__runningControlAbortCalls = [];
    target.__testWorkspaces = [];
    target.__testCurrentWorkspace = null;

    ipcMain.removeHandler("pi:status");
    ipcMain.handle("pi:status", async () => ({
      installed: true,
      localVersion: "e2e",
      latestVersion: "e2e",
      updateAvailable: false,
    }));

    ipcMain.removeHandler("agents:prompt");
    ipcMain.handle("agents:prompt", async (_event, input: { agentId: string; message: string; mode?: "build" | "plan" | "compose" }) => {
      target.__runningControlPromptCalls?.push(input);
      return undefined;
    });

    ipcMain.removeHandler("agents:abort");
    ipcMain.handle("agents:abort", async (_event, agentId: string) => {
      target.__runningControlAbortCalls?.push(agentId);
      return undefined;
    });

    ipcMain.removeHandler("workspace:create");
    ipcMain.handle("workspace:create", async (_event, name: string, path: string) => {
      const ws = { id: `ws_${Date.now()}`, name, path };
      target.__testWorkspaces?.push(ws);
      target.__testCurrentWorkspace = ws;
      return ws;
    });

    ipcMain.removeHandler("workspace:select");
    ipcMain.handle("workspace:select", async (_event, path: string) => {
      const ws = target.__testWorkspaces?.find((item) => item.path === path) ?? null;
      target.__testCurrentWorkspace = ws;
      return undefined;
    });

    ipcMain.removeHandler("workspace:list");
    ipcMain.handle("workspace:list", async () => target.__testWorkspaces ?? []);

    ipcMain.removeHandler("workspace:delete");
    ipcMain.handle("workspace:delete", async () => undefined);

    ipcMain.removeHandler("session:list");
    ipcMain.handle("session:list", async () => []);

    ipcMain.removeHandler("session:create");
    ipcMain.handle("session:create", async (_event, workspaceId: string, title?: string, id?: string) => ({
      id: id ?? `session_${Date.now()}`,
      workspaceId,
      title: title ?? "未命名会话",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    }));

    ipcMain.removeHandler("session:append-message");
    ipcMain.handle("session:append-message", async () => undefined);

    ipcMain.removeHandler("session:update-message");
    ipcMain.handle("session:update-message", async () => undefined);

    ipcMain.removeHandler("session:rename");
    ipcMain.handle("session:rename", async () => undefined);

    ipcMain.removeHandler("plan:set-enabled");
    ipcMain.handle("plan:set-enabled", async () => undefined);
  });
}

async function createWorkspace(page: Page, workspacePath: string): Promise<void> {
  await page.evaluate(async ({ workspacePath }) => {
    window.localStorage.setItem("pi-desktop:firstLaunchDone", "true");
    window.localStorage.setItem("pi-desktop.onboarding.completed", "true");
    const ws = await window.piAPI.createWorkspace("running-control-e2e", workspacePath);
    await window.piAPI.selectWorkspace(ws.path);
  }, { workspacePath });
}

test.describe("Pi Desktop running control", () => {
  let app: ElectronApplication;

  test.afterEach(async () => {
    try {
      await app?.evaluate(() => {
        const target = globalThis as RunningControlGlobals;
        target.__PI_DESKTOP_TEST_SHELL__?.quitApp();
      });
      await app?.close();
    } catch {
      // ignore
    }
  });

  test("pause execution drives abort and leaves the plan in paused state", async () => {
    const userDataDir = test.info().outputPath(`running-control-${Date.now()}`);
    const workspacePath = test.info().outputPath("running-control-workspace");
    const launched = await launchApp(userDataDir);
    app = launched.app;
    const page = launched.page;

    await installTestIpc(app);
    await createWorkspace(page, workspacePath);
    await expect(page.locator("[data-testid=\"chat-input-shell\"]")).toBeVisible({ timeout: 15_000 });

    const textbox = page.getByRole("textbox");
    await textbox.fill("先建立执行会话");
    await textbox.press("Enter");
    await expect.poll(async () => {
      return app.evaluate(() => {
        const target = globalThis as RunningControlGlobals;
        return target.__runningControlPromptCalls?.length ?? 0;
      });
    }).toBe(1);

    const initialPrompt = await app.evaluate(() => {
      const target = globalThis as RunningControlGlobals;
      return target.__runningControlPromptCalls?.[0] ?? null;
    });
    if (!initialPrompt?.agentId) {
      throw new Error("Missing initial running-control agent id");
    }
    await app.evaluate(({ BrowserWindow }, agentId: string) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("agents:event", {
          agentId,
          workspaceId: "ws_running_control",
          event: { type: "agent_end" },
        });
      }
    }, initialPrompt.agentId);
    await expect(page.getByRole("status", { name: "Pi 正在思考..." })).toHaveCount(0);

    await app.evaluate(({ BrowserWindow }) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("plan:card", {
          id: "running-control-card",
          title: "计划执行回归",
          filename: "running-control-plan.md",
          content: "- 第一步\n- 第二步",
          createdAt: Date.now(),
        });
      }
    });

    const planArticle = page.getByRole("article", { name: /Pi ·/ }).filter({ hasText: "计划执行回归" });
    await expect(planArticle).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "执行计划" }).click();

    await expect.poll(async () => {
      return app.evaluate(() => {
        const target = globalThis as RunningControlGlobals;
        return target.__runningControlPromptCalls?.length ?? 0;
      });
    }).toBe(2);

    await expect(planArticle.getByText("执行中")).toBeVisible({ timeout: 5_000 });
    await planArticle.getByRole("button", { name: "暂停执行" }).click();

    await expect.poll(async () => {
      return app.evaluate(() => {
        const target = globalThis as RunningControlGlobals;
        return target.__runningControlAbortCalls?.length ?? 0;
      });
    }).toBe(1);

    await expect(planArticle.getByText("已暂停")).toBeVisible({ timeout: 5_000 });
    await expect(planArticle.getByRole("button", { name: "继续执行" })).toBeVisible();
    await page.screenshot({ path: join(ACCEPTANCE_DIR, "2026-07-02-overlay-cluster-06-pause-paused.png"), fullPage: true });
  });
});

import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";
import { electronMainEntry } from "../playwright.config";
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { getWindowByUrl } from "./support/electron-windows";

const ACCEPTANCE_DIR = join(__dirname, "..", "..", "..", "docs", "compose", "acceptance");
const SESSION_ID = "deep-use-slash-session";
const SESSION_TITLE = "深度使用 Slash 审计";

async function ensureAcceptanceDir(): Promise<void> {
    mkdirSync(ACCEPTANCE_DIR, { recursive: true });
}

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const app = await _electron.launch({
        executablePath: resolveElectronExecutablePath(),
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: { ...process.env, CI: "1", ELECTRON_RENDERER_URL: "" },
    });
    const page = await getWindowByUrl(app, "index.html");
    await page.waitForLoadState("domcontentloaded");
    return { app, page };
}

async function closeApp(app: ElectronApplication | undefined): Promise<void> {
    try {
        await app?.close();
    } catch {
        // ignore shutdown failures during acceptance flow
    }
}

async function skipOnboarding(page: Page): Promise<void> {
    const modal = page.locator('[data-testid="onboarding-modal"]');
    if (await modal.count() === 0) return;
    await page.getByRole("button", { name: "跳过引导" }).click({ timeout: 5_000 });
    await expect(modal).toHaveCount(0, { timeout: 5_000 });
}

async function openSession(page: Page, title: string): Promise<void> {
    const sidebar = page.getByRole("navigation", { name: "会话列表" });
    const button = sidebar.getByRole("button", { name: title, exact: true });
    await expect(button).toBeVisible({ timeout: 15_000 });
    await button.click();
}

function chatTextarea(page: Page) {
    return page.locator('textarea[aria-label="发送"]').first();
}

test.describe("Pi Desktop deep-use slash surface audit", () => {
    let app: ElectronApplication | undefined;

    test.setTimeout(120_000);

    test.afterEach(async () => {
        await closeApp(app);
        app = undefined;
    });

    test("hides desktop-unsupported slash commands from the picker and shows an honest manual error", async () => {
        await ensureAcceptanceDir();
        const userDataDir = test.info().outputPath(`deep-use-slash-user-data-${Date.now()}`);
        const workspacePath = test.info().outputPath("deep-use-slash-workspace");

        let launched = await launchApp(userDataDir);
        app = launched.app;
        let page = launched.page;

        await page.evaluate(async ({ workspacePath, sessionId, sessionTitle }) => {
            window.localStorage.setItem("pi-desktop:firstLaunchDone", "true");
            window.localStorage.setItem("pi-desktop.onboarding.completed", "true");

            const workspace = await window.piAPI.createWorkspace("deep-use-slash", workspacePath);
            if (workspace && typeof workspace === "object" && "code" in workspace) {
                throw new Error(String(workspace.fallback));
            }
            await window.piAPI.selectWorkspace(workspace.path);
            const session = await window.piAPI.createSession(workspace.id, sessionTitle, sessionId);
            await window.piAPI.agentsCreate({
                workspaceId: workspace.id,
                title: `${sessionTitle} Agent`,
                sessionId: session.id,
            });
        }, { workspacePath, sessionId: SESSION_ID, sessionTitle: SESSION_TITLE });

        await closeApp(app);
        launched = await launchApp(userDataDir);
        app = launched.app;
        page = launched.page;
        await skipOnboarding(page);
        await openSession(page, SESSION_TITLE);

        const textarea = chatTextarea(page);
        await expect(textarea).toBeVisible({ timeout: 10_000 });

        await textarea.fill("/");
        await textarea.press("End");
        const listbox = page.getByRole("listbox", { name: "Pi 命令候选" });
        await expect(listbox).toBeVisible({ timeout: 10_000 });
        await expect(listbox.getByRole("option", { name: /model/i })).toBeVisible();
        await expect(listbox.getByRole("option", { name: /compact/i })).toBeVisible();
        await expect(listbox.getByRole("option", { name: /goal/i })).toBeVisible();
        await expect(listbox.getByRole("option", { name: /clone/i })).toHaveCount(0);
        await expect(listbox.getByRole("option", { name: /tree/i })).toHaveCount(0);
        await expect(listbox.getByRole("option", { name: /import/i })).toHaveCount(0);
        await expect(listbox.getByRole("option", { name: /share/i })).toHaveCount(0);
        await page.screenshot({ path: join(ACCEPTANCE_DIR, "2026-06-26-deep-use-10-slash-picker-supported-only.png"), fullPage: true });

        await textarea.fill("/tree");
        await page.getByRole("button", { name: "发送" }).click();
        await expect(page.getByRole("alert")).toContainText("/tree 暂未接入 Pi Desktop，请在 Pi CLI 终端使用。", { timeout: 10_000 });
        await expect(textarea).toHaveValue("/tree");
        await page.screenshot({ path: join(ACCEPTANCE_DIR, "2026-06-26-deep-use-11-slash-manual-unsupported-honest-error.png"), fullPage: true });
    });
});

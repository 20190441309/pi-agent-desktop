import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { electronMainEntry } from "../playwright.config";

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const app = await _electron.launch({
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: { ...process.env, CI: "1", ELECTRON_RENDERER_URL: "" },
    });
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    return { app, page };
}

test.describe("Pi Desktop — session history navigation", () => {
    let app: ElectronApplication | undefined;

    test.afterEach(async () => {
        try {
            await app?.close();
        } catch {
            // ignore cleanup failures in Electron shutdown
        } finally {
            app = undefined;
        }
    });

    test("clicking a persisted history item opens its message detail", async () => {
        const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const workspacePath = test.info().outputPath("workspace");
        const now = Date.now();

        let page: Page;
        ({ app, page } = await launchApp(userDataDir));

        await page.evaluate(
            async ({ workspacePath, now }) => {
                window.localStorage.setItem("pi-desktop:firstLaunchDone", "true");
                const ws = await window.piAPI.createWorkspace("history-e2e", workspacePath);
                const oldSession = await window.piAPI.createSession(ws.id, "旧会话", "e2e-old-session");
                const targetSession = await window.piAPI.createSession(ws.id, "目标会话", "e2e-target-session");

                await window.piAPI.appendMessage(oldSession.id, {
                    id: "old-message",
                    role: "user",
                    content: "old message should not be selected",
                    timestamp: new Date(now - 10_000).toISOString(),
                });
                await window.piAPI.appendMessage(targetSession.id, {
                    id: "target-user-message",
                    role: "user",
                    content: "打开历史会话后必须看到这条用户消息",
                    timestamp: new Date(now - 5_000).toISOString(),
                });
                await window.piAPI.appendMessage(targetSession.id, {
                    id: "target-assistant-message",
                    role: "assistant",
                    content: "打开历史会话后必须看到这条助手回复",
                    timestamp: new Date(now - 4_000).toISOString(),
                });
            },
            { workspacePath, now },
        );

        await app.close();
        app = undefined;

        ({ app, page } = await launchApp(userDataDir));

        await page.locator('button[data-mmcode-section="new-task"]').click();
        await expect(page.getByText("描述你想要构建或修改的内容")).toBeVisible({ timeout: 15_000 });

        await page.locator('button[data-mmcode-section="session:e2e-target-session"]').click();

        await expect(page.getByRole("article", { name: /你说/ })).toContainText(
            "打开历史会话后必须看到这条用户消息",
            { timeout: 10_000 },
        );
        await expect(page.getByRole("article", { name: /Pi 说/ })).toContainText(
            "打开历史会话后必须看到这条助手回复",
            { timeout: 10_000 },
        );
        await expect(page.getByText("描述你想要构建或修改的内容")).toHaveCount(0);
    });
});

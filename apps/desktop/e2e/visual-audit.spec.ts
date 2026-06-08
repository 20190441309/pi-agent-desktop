import { mkdir } from "fs/promises";
import { join } from "path";
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

async function expectHealthyLayout(page: Page): Promise<void> {
    await expect(page.getByText("出错了")).toHaveCount(0);
    const overflow = await page.evaluate(() => ({
        body: document.body.scrollWidth - document.body.clientWidth,
        root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.body, "body should not have horizontal overflow").toBeLessThanOrEqual(2);
    expect(overflow.root, "documentElement should not have horizontal overflow").toBeLessThanOrEqual(2);
}

async function screenshot(page: Page, dir: string, name: string): Promise<void> {
    await page.screenshot({ path: join(dir, `${name}.png`), fullPage: false });
}

async function expectSingleSidebarCurrent(page: Page, label: string): Promise<void> {
    const currentItems = page.locator('nav[aria-label="主导航"] button[aria-current="page"]');
    await expect(currentItems).toHaveCount(1);
    await expect(currentItems.first()).toHaveAttribute("aria-label", label);
}

test.describe("Pi Desktop — visual function audit", () => {
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

    test("major screens show polished, non-empty user-facing UI", async () => {
        const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const workspacePath = test.info().outputPath("workspace");
        const screenshotDir = test.info().outputPath("visual-audit");
        await mkdir(screenshotDir, { recursive: true });

        let page: Page;
        ({ app, page } = await launchApp(userDataDir));

        await page.evaluate(
            async ({ workspacePath }) => {
                window.localStorage.setItem("pi-desktop:firstLaunchDone", "true");
                const ws = await window.piAPI.createWorkspace("visual-audit", workspacePath);
                const session = await window.piAPI.createSession(ws.id, "UI 巡检会话", "visual-audit-session");
                await window.piAPI.appendMessage(session.id, {
                    id: "visual-user",
                    role: "user",
                    content: "请检查这个桌面应用的主要界面是否正常展示。",
                    timestamp: new Date(Date.now() - 3_000).toISOString(),
                });
                await window.piAPI.appendMessage(session.id, {
                    id: "visual-assistant",
                    role: "assistant",
                    content: "主要界面已加载。这里是一段较长的回复，用来验证消息气泡的换行、间距、时间戳和工具摘要是否稳定。",
                    timestamp: new Date(Date.now() - 2_000).toISOString(),
                    toolCalls: [
                        {
                            id: "visual-tool",
                            name: "read",
                            status: "completed",
                            output: "C:/visual-audit/output.txt",
                            startTime: new Date(Date.now() - 2_500).toISOString(),
                            endTime: new Date(Date.now() - 2_200).toISOString(),
                        },
                    ],
                });
            },
            { workspacePath },
        );

        await app.close();
        app = undefined;

        ({ app, page } = await launchApp(userDataDir));

        await expect(page.locator('nav[aria-label="主导航"]')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('nav[aria-label="主导航"]').getByRole("button", { name: "Git" })).toHaveCount(0);
        await expectHealthyLayout(page);
        await screenshot(page, screenshotDir, "01-initial-loaded");

        await page.locator('button[data-mmcode-section="new-task"]').click();
        await expect(page.getByText("描述你想要构建或修改的内容")).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole("button", { name: /添加附件/ })).toBeVisible();
        await expectHealthyLayout(page);
        await screenshot(page, screenshotDir, "02-new-task");

        await page.locator('button[data-mmcode-section="session:visual-audit-session"]').click();
        await expect(page.getByRole("article", { name: /你说/ })).toContainText("请检查这个桌面应用");
        await expect(page.getByRole("article", { name: /Pi 说/ })).toContainText("主要界面已加载");
        await expect(page.getByText("查看 1 个文件")).toBeVisible();
        await expectSingleSidebarCurrent(page, "UI 巡检会话");
        await expectHealthyLayout(page);
        await screenshot(page, screenshotDir, "03-session-detail");

        await page.locator('button[data-mmcode-section="skills"]').click();
        await expect(page.getByRole("region", { name: "插件面板" })).toBeVisible();
        await expect(page.getByRole("tab", { name: "Pi 插件" })).toBeVisible();
        await expect(page.getByText("加载 Pi 插件市场...")).toBeHidden({ timeout: 30_000 });
        await expect(page.getByText(/spawn pi|Command failed|ENOENT/)).toHaveCount(0);
        await expect(page.locator('[role="alert"]')).toHaveCount(0);
        await expectSingleSidebarCurrent(page, "插件");
        await expectHealthyLayout(page);
        await screenshot(page, screenshotDir, "04-skills");

        await page.locator('button[data-mmcode-section="settings"]').click();
        const settingsDialog = page.getByRole("dialog", { name: "设置" });
        await expect(settingsDialog).toBeVisible();
        await expect(settingsDialog.getByRole("tablist", { name: "设置分类" })).toBeVisible();
        await expectHealthyLayout(page);
        await screenshot(page, screenshotDir, "05-settings");
        await settingsDialog.locator('button[aria-label="关闭"]').click();
        await expect(settingsDialog).toBeHidden();

        await page.keyboard.press("Control+k");
        const palette = page.locator('[role="dialog"][aria-label*="命令面板"]');
        await expect(palette).toBeVisible();
        await expect(palette.locator('input[aria-label="搜索命令"]')).toBeVisible();
        await expectHealthyLayout(page);
        await screenshot(page, screenshotDir, "06-command-palette");
    });
});

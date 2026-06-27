import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { electronMainEntry } from "../playwright.config";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { resolveElectronExecutablePath } from "./support/electron-launch";

const ACCEPTANCE_DIR = join(__dirname, "..", "..", "..", "docs", "compose", "acceptance");
const SESSION_ID = "deep-use-surface-session";
const SESSION_TITLE = "深度使用面板审计";
const GOAL_CONDITION = "完成 deep-use 任务面板联动验证";
const SKILL_NAME = "deep-use-audit-skill";

async function ensureAcceptanceDir(): Promise<void> {
    mkdirSync(ACCEPTANCE_DIR, { recursive: true });
}

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const app = await _electron.launch({
        executablePath: resolveElectronExecutablePath(),
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: { ...process.env, CI: "1", ELECTRON_RENDERER_URL: "" },
    });
    const page = await app.firstWindow();
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

test.describe("Pi Desktop deep-use surface audit", () => {
    let app: ElectronApplication | undefined;

    test.setTimeout(120_000);

    test.afterEach(async () => {
        await closeApp(app);
        app = undefined;
    });

    test("verifies goal/task linkage and tools panel real skill writing in Electron", async () => {
        await ensureAcceptanceDir();
        const userDataDir = test.info().outputPath(`deep-use-surface-user-data-${Date.now()}`);
        const workspacePath = test.info().outputPath("deep-use-surface-workspace");
        const skillPath = join(workspacePath, ".agents", "skills", SKILL_NAME, "SKILL.md");

        let launched = await launchApp(userDataDir);
        app = launched.app;
        let page = launched.page;

        const bootstrap = await page.evaluate(async ({ workspacePath, sessionId, sessionTitle }) => {
            window.localStorage.setItem("pi-desktop:firstLaunchDone", "true");
            window.localStorage.setItem("pi-desktop.onboarding.completed", "true");

            const settings = await window.piAPI.getSettings();
            await window.piAPI.setSettings({
                longHorizon: {
                    ...(settings.longHorizon ?? {}),
                    enabled: true,
                    goal: { enabled: true },
                    task: { enabled: true },
                    memory: { enabled: true },
                    history: { enabled: true },
                    checkpoint: { enabled: true },
                    planMode: { enabled: true },
                    composeMode: { enabled: true },
                },
            });

            const workspace = await window.piAPI.createWorkspace("deep-use-surface", workspacePath);
            if (workspace && typeof workspace === "object" && "code" in workspace) {
                throw new Error(String(workspace.fallback));
            }
            await window.piAPI.selectWorkspace(workspace.path);
            const session = await window.piAPI.createSession(workspace.id, sessionTitle, sessionId);
            const agent = await window.piAPI.agentsCreate({
                workspaceId: workspace.id,
                title: `${sessionTitle} Agent`,
                sessionId: session.id,
            });
            return { workspaceId: workspace.id, agentId: agent.id };
        }, { workspacePath, sessionId: SESSION_ID, sessionTitle: SESSION_TITLE });

        await closeApp(app);
        launched = await launchApp(userDataDir);
        app = launched.app;
        page = launched.page;
        await skipOnboarding(page);
        await openSession(page, SESSION_TITLE);
        await expect.poll(async () => page.evaluate(async (sessionId) => {
            const agents = await window.piAPI.agentsList();
            return agents.find((item) => item.sessionId === sessionId)?.id ?? null;
        }, SESSION_ID), { timeout: 15_000 }).not.toBeNull();

        const textarea = chatTextarea(page);
        await expect(textarea).toBeVisible({ timeout: 10_000 });

        const initialArticleCount = await page.locator("article").count();
        await textarea.fill(`/goal ${GOAL_CONDITION}`);
        await textarea.press("Enter");

        await expect(textarea).toHaveValue("", { timeout: 5_000 });
        await page.waitForTimeout(1_000);
        await expect.poll(async () => page.evaluate(async ({ workspaceId, sessionId }) => {
            const agents = await window.piAPI.agentsList();
            const boundAgent = agents.find((item) => item.sessionId === sessionId);
            if (!boundAgent) return null;
            const result = await window.piAPI.goalGet(workspaceId, boundAgent.id);
            if (result && typeof result === "object" && "code" in result) return null;
            return result && typeof result === "object" && "condition" in result
                ? String(result.condition)
                : null;
        }, { workspaceId: bootstrap.workspaceId, sessionId: SESSION_ID }), { timeout: 10_000 }).toBe(GOAL_CONDITION);
        await expect(page.locator("article")).toHaveCount(initialArticleCount);
        await page.screenshot({ path: join(ACCEPTANCE_DIR, "2026-06-26-deep-use-06-goal-command-no-chat-effect.png"), fullPage: true });

        await page.getByRole("tab", { name: "任务" }).click();
        await expect(page.getByText("任务总览")).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(GOAL_CONDITION).first()).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText("运行中")).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ path: join(ACCEPTANCE_DIR, "2026-06-26-deep-use-07-task-goal-linked.png"), fullPage: true });

        await page.getByRole("tab", { name: "工具" }).click();
        await expect(page.getByRole("region", { name: "插件面板" })).toBeVisible({ timeout: 10_000 });
        await page.getByRole("button", { name: /创建/ }).click();
        await page.getByRole("button", { name: /编写技能/ }).last().click();

        const dialog = page.getByRole("dialog", { name: "编写技能" });
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await dialog.getByPlaceholder("my-skill").fill(SKILL_NAME);
        await dialog.getByPlaceholder("一句话说明 Pi 何时该调这个 skill").fill("用于验证工具页真实写盘能力");
        await dialog.getByPlaceholder("Pi 应该按什么步骤执行").fill("1. 创建文件\n2. 校验已安装列表可见");
        await dialog.getByRole("button", { name: "保存 SKILL.md" }).click();

        await expect(dialog.getByRole("button", { name: "✓ 已保存" })).toBeVisible({ timeout: 10_000 });
        expect(existsSync(skillPath)).toBe(true);
        await page.screenshot({ path: join(ACCEPTANCE_DIR, "2026-06-26-deep-use-08-tools-skill-saved.png"), fullPage: true });
        await expect(dialog).toHaveCount(0, { timeout: 5_000 });

        await page.getByRole("tab", { name: "已安装" }).click();
        await expect(page.getByText(SKILL_NAME, { exact: true })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText("SkillHub · 已启用")).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ path: join(ACCEPTANCE_DIR, "2026-06-26-deep-use-09-tools-installed-skill-visible.png"), fullPage: true });
    });
});

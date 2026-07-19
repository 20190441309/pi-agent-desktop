import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { electronMainEntry } from "../playwright.config";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { getWindowByUrl, hideSettingsWindow, showSettingsWindow } from "./support/electron-windows";

const SCREENSHOT_DIR = join(__dirname, "..", "e2e-output", "long-horizon-live");
const DEEP_API_KEY_ENV = "PI_DESKTOP_DEEP_API_KEY";
const liveDescribe = process.env.RUN_LONG_HORIZON_ACCEPTANCE === "1"
    ? test.describe
    : test.describe.skip;

interface LiveContext {
    app: ElectronApplication;
    page: Page;
    workspaceId: string;
    workspacePath: string;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isClosedPageError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /Target page, context or browser has been closed/i.test(message);
}

function resolveLongCatApiKey(): string {
    const direct = process.env.LONGCAT_API_KEY?.trim();
    if (direct) return direct;
    const authPath = join(process.env.USERPROFILE ?? "", ".pi", "agent", "auth.json");
    if (!existsSync(authPath)) {
        throw new Error("Missing LONGCAT_API_KEY and ~/.pi/agent/auth.json");
    }
    const auth = JSON.parse(readFileSync(authPath, "utf8")) as {
        longcat?: { key?: string; apiKey?: string };
    };
    const key = auth.longcat?.key ?? auth.longcat?.apiKey;
    if (!key) {
        throw new Error("LongCat API key not found in auth.json");
    }
    return key;
}

function writeProviderConfig(configDir: string, apiKey: string): void {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "models.json"), JSON.stringify({
        providers: {
            longcat: {
                name: "LongCat",
                baseUrl: "https://api.longcat.chat/openai",
                apiKey: DEEP_API_KEY_ENV,
                api: "openai-completions",
                models: [{
                    id: "LongCat-2.0-Preview",
                    name: "LongCat 2.0 Preview",
                    reasoning: false,
                    input: ["text"],
                    contextWindow: 128000,
                    maxTokens: 4096,
                }],
            },
        },
    }, null, 2), "utf8");
    writeFileSync(join(configDir, "settings.json"), JSON.stringify({
        defaultProvider: "longcat",
        defaultModel: "LongCat-2.0-Preview",
    }, null, 2), "utf8");
    process.env[DEEP_API_KEY_ENV] = apiKey;
}

function seedWorkspace(workspacePath: string): void {
    mkdirSync(workspacePath, { recursive: true });
    writeFileSync(join(workspacePath, "package.json"), JSON.stringify({
        name: "pi-desktop-long-horizon-live",
        version: "0.0.0",
        private: true,
    }, null, 2), "utf8");
    writeFileSync(join(workspacePath, "README.md"), "# live acceptance\n", "utf8");
}

async function skipOnboarding(page: Page): Promise<void> {
    const modal = page.locator('[data-testid="onboarding-modal"]');
    if (await modal.count() === 0) return;
    await page.getByRole("button", { name: "跳过引导" }).click({ timeout: 5_000 });
    await expect(modal).toHaveCount(0, { timeout: 5_000 });
}

async function launchLiveApp(): Promise<LiveContext> {
    const apiKey = resolveLongCatApiKey();
    const userDataDir = test.info().outputPath(`user-data-${Date.now()}`);
    const configDir = test.info().outputPath(`pi-agent-config-${Date.now()}`);
    const workspacePath = test.info().outputPath(`workspace-${Date.now()}`);
    writeProviderConfig(configDir, apiKey);
    seedWorkspace(workspacePath);

    const app = await _electron.launch({
        executablePath: resolveElectronExecutablePath(),
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: {
            ...process.env,
            CI: "1",
            ELECTRON_RENDERER_URL: "",
            PI_DESKTOP_CONFIG_DIR: configDir,
            [DEEP_API_KEY_ENV]: apiKey,
        },
    });
    const page = await getWindowByUrl(app, "index.html");
    await page.waitForLoadState("domcontentloaded");
    await skipOnboarding(page);

    const workspace = await page.evaluate(async ({ workspacePath }) => {
        window.localStorage.setItem("pi-desktop:firstLaunchDone", "true");
        window.localStorage.setItem("pi-desktop.onboarding.completed", "true");
        const created = await window.piAPI.createWorkspace("long-horizon-live", workspacePath);
        if (!created || !("id" in created)) {
            throw new Error("Failed to create live acceptance workspace");
        }
        await window.piAPI.selectWorkspace(created.path);
        await window.piAPI.setSettings({
            provider: "longcat",
            model: "LongCat-2.0-Preview",
        });
        return created;
    }, { workspacePath });

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await skipOnboarding(page);
    return {
        app,
        page,
        workspaceId: workspace.id,
        workspacePath,
    };
}

async function takeScreenshot(page: Page, name: string): Promise<void> {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`) });
}

async function openSettingsWindow(app: ElectronApplication, page: Page): Promise<Page> {
    const settingsWindow = await showSettingsWindow(app, page);
    await expect(settingsWindow.getByRole("tablist", { name: "设置分类" })).toBeVisible({ timeout: 10_000 });
    return settingsWindow;
}

async function setSwitch(page: Page, label: string, checked: boolean): Promise<void> {
    const control = page.getByRole("switch", { name: label });
    await expect(control).toBeVisible({ timeout: 10_000 });
    const current = (await control.getAttribute("aria-checked")) === "true";
    if (current !== checked) {
        await control.click();
        await expect(control).toHaveAttribute("aria-checked", checked ? "true" : "false");
    }
}

async function waitForRuntimeFlags(
    page: Page,
    expected: Partial<Record<"planMode" | "composeMode" | "goal" | "memory" | "history" | "checkpoint" | "task" | "actor" | "subagents", boolean>>,
): Promise<void> {
    await expect.poll(async () => {
        const state = await page.evaluate(async () => {
            return await window.piAPI.runtimeFeatureState();
        });
        return {
            planMode: state.features.planMode.enabled,
            composeMode: state.features.composeMode.enabled,
            goal: state.features.goal.enabled,
            memory: state.features.memory.enabled,
            history: state.features.history.enabled,
            checkpoint: state.features.checkpoint.enabled,
            task: state.features.task.enabled,
            actor: state.features.actor.enabled,
            subagents: state.features.subagents.enabled,
        };
    }, { timeout: 20_000 }).toMatchObject(expected);
}

async function ensureRightRailExpanded(page: Page): Promise<void> {
    const expand = page.getByRole("button", { name: "展开右侧栏" });
    if (await expand.isVisible().catch(() => false)) {
        await expand.click();
    }
    await expect(page.getByText("环境信息")).toBeVisible({ timeout: 10_000 });
}

async function openModeMenu(page: Page): Promise<void> {
    const trigger = page.getByRole("button", { name: "选择 Agent 模式" });
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();
    await expect(page.getByRole("menu", { name: "Agent 模式" })).toBeVisible({ timeout: 5_000 });
}

async function selectMode(page: Page, mode: "Build" | "Plan" | "Compose"): Promise<void> {
    await openModeMenu(page);
    await page.getByRole("menuitemradio", { name: new RegExp(mode, "i") }).click();
    await expect(page.getByRole("button", { name: "选择 Agent 模式" })).toContainText(mode);
}

async function sendPrompt(page: Page, prompt: string): Promise<number> {
    const initialArticleCount = await page.locator("article").count();
    const textarea = page.locator('textarea[aria-label="发送"]');
    await expect(textarea).toBeVisible({ timeout: 10_000 });
    await textarea.fill(prompt);
    await textarea.press("Enter");
    return initialArticleCount;
}

function latestAssistantArticle(page: Page) {
    return page.getByRole("article", { name: /Pi ·/ }).last();
}

async function latestAssistantFailure(page: Page): Promise<string | null> {
    const alertFailure = page.getByRole("alert").filter({ hasText: "发送失败" }).first();
    if (await alertFailure.isVisible().catch(() => false)) {
        return (await alertFailure.textContent())?.trim() ?? "发送失败";
    }

    const assistant = latestAssistantArticle(page);
    if (!await assistant.isVisible().catch(() => false)) return null;
    const text = ((await assistant.textContent()) ?? "").replace(/\s+/g, " ").trim();
    if (!text) return null;
    if (text.includes("被用户拒绝") || text.includes("策略阻止了此次操作")) {
        return text;
    }
    return null;
}

interface PermissionWatcher {
    stop: () => Promise<void>;
}

function startPermissionWatcher(page: Page): PermissionWatcher {
    let active = true;
    let lastError: Error | null = null;
    const loop = (async () => {
        while (active) {
            if (page.isClosed()) return;
            try {
                const dialog = page.getByRole("alertdialog", { name: /^权限请求 \d+$/ }).first();
                if (await dialog.isVisible().catch(() => false)) {
                    const previousText = ((await dialog.textContent()) ?? "").replace(/\s+/g, " ").trim();
                    await dialog.getByRole("button", { name: "仅本对话" }).click();
                    await expect.poll(async () => {
                        if (!await dialog.isVisible().catch(() => false)) return "cleared";
                        const nextText = ((await dialog.textContent()) ?? "").replace(/\s+/g, " ").trim();
                        return nextText === previousText ? "same" : "advanced";
                    }, { timeout: 5_000 }).not.toBe("same");
                    continue;
                }
                await sleep(150);
            } catch (error) {
                if (!active || page.isClosed() || isClosedPageError(error)) return;
                lastError = error instanceof Error ? error : new Error(String(error));
                return;
            }
        }
    })();

    return {
        async stop() {
            active = false;
            await loop;
            if (lastError) throw lastError;
        },
    };
}

async function withPermissionWatcher<T>(page: Page, action: () => Promise<T>): Promise<T> {
    const watcher = startPermissionWatcher(page);
    try {
        return await action();
    } finally {
        await watcher.stop();
    }
}

async function executePendingPlan(page: Page): Promise<void> {
    const directExecute = page.getByRole("button", { name: "执行计划" });
    const optionButtons = page.getByRole("button", { name: /^选项 / });
    const confirmExecute = page.getByRole("button", { name: "确认并执行" });

    await expect.poll(async () => {
        if (await directExecute.isVisible().catch(() => false)) return "direct";
        if (await optionButtons.first().isVisible().catch(() => false)) return "options";
        return "pending";
    }, { timeout: 30_000 }).not.toBe("pending");

    if (await directExecute.isVisible().catch(() => false)) {
        await directExecute.click();
        return;
    }

    await optionButtons.first().click();
    await expect(confirmExecute).toBeEnabled({ timeout: 10_000 });
    await confirmExecute.click();
}

async function waitForAssistantTurn(page: Page, initialArticleCount: number, timeout = 120_000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const failure = await latestAssistantFailure(page);
        if (failure) {
            throw new Error(failure);
        }
        const articles = await page.locator("article").count();
        if (articles >= initialArticleCount + 2) {
            const settledFailure = await latestAssistantFailure(page);
            if (settledFailure) {
                throw new Error(settledFailure);
            }
            return;
        }
        await page.waitForTimeout(500);
    }
    throw new Error(`Timed out waiting for assistant response after ${timeout}ms`);
}

async function waitForRunToFinish(page: Page, timeout = 240_000): Promise<void> {
    const stopButton = page.getByRole("button", { name: "停止生成" });
    const pauseButtons = page.getByRole("button", { name: "暂停执行" });
    const deadline = Date.now() + timeout;
    let lastSignature = "";
    let lastActivityAt = Date.now();
    while (Date.now() < deadline) {
        const articleCount = await page.locator("article").count();
        const alertCount = await page.getByRole("alert").count();
        const permissionDialog = page.getByRole("alertdialog", { name: /^权限请求 \d+$/ }).first();
        const permissionVisible = await permissionDialog.isVisible().catch(() => false);
        const stopVisible = await stopButton.isVisible().catch(() => false);
        const pauseVisible = await pauseButtons.first().isVisible().catch(() => false);
        const busyVisible = stopVisible || pauseVisible;
        const signature = `${articleCount}|${alertCount}|${permissionVisible}|${busyVisible}`;
        if (signature !== lastSignature) {
            lastSignature = signature;
            lastActivityAt = Date.now();
        }

        const failure = await latestAssistantFailure(page);
        if (failure) {
            throw new Error(failure);
        }

        if (!busyVisible && !permissionVisible && Date.now() - lastActivityAt >= 2_000) {
            return;
        }
        await page.waitForTimeout(250);
    }
    throw new Error(`Timed out waiting for run completion after ${timeout}ms`);
}

liveDescribe("Pi Desktop long-horizon live acceptance", () => {
    let context: LiveContext | null = null;

    test.setTimeout(1_200_000);

    test.afterEach(async () => {
        try {
            await context?.app.close();
        } catch {
            // ignore teardown failures
        }
        context = null;
    });

    test("validates long-horizon settings gates and real build/plan/compose flows", async () => {
        context = await launchLiveApp();
        const { app, page, workspacePath } = context;
        await takeScreenshot(page, "01-main-window-ready");

        const settingsWindow = await openSettingsWindow(app, page);
        await settingsWindow.getByRole("tab", { name: "长程能力" }).click();
        await expect(settingsWindow.getByText("控制 MiMoCode 风格的模式、Goal、计划联动、记忆和 checkpoint 适配层。")).toBeVisible();

        await setSwitch(settingsWindow, "启用增强能力", true);
        await setSwitch(settingsWindow, "Plan Mode", true);
        await setSwitch(settingsWindow, "Compose Mode", true);
        await setSwitch(settingsWindow, "Goal / 停止条件", true);
        await setSwitch(settingsWindow, "持久记忆", true);
        await setSwitch(settingsWindow, "History 原始轨迹", true);
        await setSwitch(settingsWindow, "Checkpoint", true);
        await setSwitch(settingsWindow, "Task Registry", true);
        await setSwitch(settingsWindow, "Actor / Subagent", true);
        await setSwitch(settingsWindow, "系统 Subagents", true);
        await expect(settingsWindow.getByRole("switch", { name: "Max Mode" })).toHaveCount(0);
        await waitForRuntimeFlags(page, {
            planMode: true,
            composeMode: true,
            goal: true,
            memory: true,
            history: true,
            checkpoint: true,
            task: true,
            actor: true,
            subagents: true,
        });
        await takeScreenshot(settingsWindow, "02-settings-long-horizon-enabled");
        await hideSettingsWindow(context.app, settingsWindow);
        await page.bringToFront();

        await openModeMenu(page);
        await expect(page.getByRole("menuitemradio", { name: /Build/i })).toBeVisible();
        await expect(page.getByRole("menuitemradio", { name: /Plan/i })).toBeVisible();
        await expect(page.getByRole("menuitemradio", { name: /Compose/i })).toBeVisible();
        await expect(page.getByRole("menuitemradio", { name: /Max/i })).toHaveCount(0);
        await takeScreenshot(page, "03-mode-menu-all-enabled");
        await page.keyboard.press("Escape");

        await ensureRightRailExpanded(page);
        await takeScreenshot(page, "04-right-rail-opened");

        await selectMode(page, "Build");
        await withPermissionWatcher(page, async () => {
            const buildArticleCount = await sendPrompt(page, "请创建一个 build_probe.txt 文件，内容只有 BUILD_OK。完成后只用一句中文说明。");
            await waitForAssistantTurn(page, buildArticleCount);
            await waitForRunToFinish(page);
            await expect.poll(() => existsSync(join(workspacePath, "build_probe.txt")), { timeout: 30_000 }).toBe(true);
        });
        await takeScreenshot(page, "05-build-mode-finished");

        await selectMode(page, "Plan");
        await withPermissionWatcher(page, async () => {
            const planArticleCount = await sendPrompt(page, "请为当前工作区生成一个简短计划：1. 创建 plan_probe.txt，内容为 PLAN_OK。2. 验证文件存在。生成计划后等待执行，不要自己直接执行。");
            await waitForAssistantTurn(page, planArticleCount);
            await waitForRunToFinish(page);
            await takeScreenshot(page, "06-plan-mode-plan-card");
            const executionStartArticleCount = await page.locator("article").count();
            await executePendingPlan(page);
            await waitForAssistantTurn(page, executionStartArticleCount, 180_000);
            await waitForRunToFinish(page, 300_000);
            await expect.poll(() => existsSync(join(workspacePath, "plan_probe.txt")), { timeout: 30_000 }).toBe(true);
        });
        await takeScreenshot(page, "07-plan-mode-executed");

        await page.getByRole("tab", { name: "任务" }).click();
        await expect(page.getByText("任务总览")).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText("任务列表")).toBeVisible();
        await takeScreenshot(page, "08-task-panel-live");

        await page.getByRole("tab", { name: "记忆" }).click();
        await expect(page.getByRole("heading", { name: "记忆" })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText("最近记忆 · long-horizon-live")).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText("请为当前工作区生成一个简短计划：1. 创建 plan_probe.txt，内容为 PLAN_OK。2. 验证文件存在。生成计划后等待执行，不要自己直接执行。")).toBeVisible({ timeout: 20_000 });
        await takeScreenshot(page, "09-memory-panel-live");

        await page.getByRole("tab", { name: "对话" }).click();
        await selectMode(page, "Compose");
        await withPermissionWatcher(page, async () => {
            const composeArticleCount = await sendPrompt(page, "请审查 build_probe.txt 和 plan_probe.txt，输出三段：观察、风险、下一步。不要修改任何文件。");
            await waitForAssistantTurn(page, composeArticleCount);
            await waitForRunToFinish(page);
        });
        const composeReviewArticle = page.locator("article").last();
        await expect(composeReviewArticle.getByText("观察", { exact: true })).toBeVisible({ timeout: 30_000 });
        await expect(composeReviewArticle.getByText("风险", { exact: true })).toBeVisible();
        await expect(composeReviewArticle.getByText("下一步", { exact: true })).toBeVisible();
        await takeScreenshot(page, "10-compose-mode-finished");

        const disabledSettings = await openSettingsWindow(app, page);
        await disabledSettings.getByRole("tab", { name: "长程能力" }).click();
        await setSwitch(disabledSettings, "Plan Mode", false);
        await setSwitch(disabledSettings, "Compose Mode", false);
        await setSwitch(disabledSettings, "Goal / 停止条件", false);
        await setSwitch(disabledSettings, "持久记忆", false);
        await setSwitch(disabledSettings, "History 原始轨迹", false);
        await setSwitch(disabledSettings, "Checkpoint", false);
        await setSwitch(disabledSettings, "Task Registry", false);
        await setSwitch(disabledSettings, "Actor / Subagent", false);
        await setSwitch(disabledSettings, "系统 Subagents", false);
        await waitForRuntimeFlags(page, {
            planMode: false,
            composeMode: false,
            goal: false,
            memory: false,
            history: false,
            checkpoint: false,
            task: false,
            actor: false,
            subagents: false,
        });
        await takeScreenshot(disabledSettings, "11-settings-long-horizon-disabled");
        await hideSettingsWindow(context.app, disabledSettings);
        await page.bringToFront();

        await openModeMenu(page);
        await expect(page.getByRole("menuitemradio", { name: /Build/i })).toBeVisible();
        await expect(page.getByRole("menuitemradio", { name: /Plan/i })).toHaveCount(0);
        await expect(page.getByRole("menuitemradio", { name: /Compose/i })).toHaveCount(0);
        await expect(page.getByRole("menuitemradio", { name: /Max/i })).toHaveCount(0);
        await takeScreenshot(page, "12-mode-menu-disabled");
        await page.keyboard.press("Escape");

        await page.getByRole("tab", { name: "任务" }).click();
        await expect(page.getByText("当前未启用 task registry")).toBeVisible({ timeout: 10_000 });
        await takeScreenshot(page, "13-task-panel-disabled");

        await page.getByRole("tab", { name: "记忆" }).click();
        await expect(page.getByText("当前未启用 memory system")).toBeVisible({ timeout: 10_000 });
        await takeScreenshot(page, "14-memory-panel-disabled");
    });
});

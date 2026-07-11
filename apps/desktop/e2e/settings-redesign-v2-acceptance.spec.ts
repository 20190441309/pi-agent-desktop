import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { electronMainEntry } from "../playwright.config";
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { getWindowByUrl } from "./support/electron-windows";

const ACCEPTANCE_DIR = join(__dirname, "..", "..", "..", "docs", "compose", "acceptance");

async function writePiConfig(configDir: string): Promise<void> {
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, "settings.json"), JSON.stringify({
        defaultProvider: "mimo",
        defaultModel: "mimo-v2.5",
    }, null, 2), "utf8");
    await writeFile(join(configDir, "models.json"), JSON.stringify({
        providers: {
            mimo: {
                name: "MiMo",
                baseUrl: "https://mimo.example/v1",
                api: "openai-completions",
                models: [
                    {
                        id: "mimo-v2.5",
                        name: "MiMo v2.5",
                        contextWindow: 128000,
                        maxTokens: 4096,
                    },
                ],
            },
        },
    }, null, 2), "utf8");
}

async function launchApp(userDataDir: string, configDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const app = await _electron.launch({
        executablePath: resolveElectronExecutablePath(),
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: {
            ...process.env,
            CI: "1",
            ELECTRON_RENDERER_URL: "",
            PI_DESKTOP_CONFIG_DIR: configDir,
        },
    });
    const page = await getWindowByUrl(app, "index.html");
    await page.waitForLoadState("domcontentloaded");
    return { app, page };
}

async function prepareWorkspace(page: Page, workspacePath: string): Promise<void> {
    await page.evaluate(async ({ workspacePath }) => {
        window.localStorage.setItem("pi-desktop:firstLaunchDone", "true");
        window.localStorage.setItem("pi-desktop.onboarding.completed", "true");
        const workspace = await window.piAPI.createWorkspace("settings-redesign-v2", workspacePath);
        await window.piAPI.selectWorkspace(workspace.path);
    }, { workspacePath });

    const onboardingModal = page.locator('[data-testid="onboarding-modal"]');
    if (await onboardingModal.count()) {
        await page.getByRole("button", { name: "跳过引导" }).click({ timeout: 5_000 });
        await expect(onboardingModal).toHaveCount(0);
    }

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
}

async function openSettingsWindow(app: ElectronApplication, page: Page): Promise<Page> {
    const settingsWindowPromise = app.waitForEvent("window");
    await page.getByRole("button", { name: "打开设置" }).click();
    const settingsWindow = await settingsWindowPromise;
    await settingsWindow.waitForLoadState("domcontentloaded");
    await expect(settingsWindow.getByRole("tablist", { name: "设置分类" })).toBeVisible({ timeout: 10_000 });
    return settingsWindow;
}

async function capture(page: Page, fileName: string): Promise<void> {
    await mkdir(ACCEPTANCE_DIR, { recursive: true });
    await page.screenshot({
        path: join(ACCEPTANCE_DIR, fileName),
        animations: "disabled",
        fullPage: true,
    });
}

test.describe("Settings redesign v2 acceptance", () => {
    let app: ElectronApplication | undefined;

    test.afterEach(async () => {
        try {
            await app?.close();
        } catch {
            // Ignore shutdown races in Electron.
        } finally {
            app = undefined;
        }
    });

    test("verifies single left-nav settings IA, Pi Code Agent page, and local search positioning", async () => {
        const userDataDir = test.info().outputPath(`settings-redesign-v2-${Date.now()}`);
        const configDir = `${userDataDir}-pi-config`;
        const workspacePath = test.info().outputPath("workspace");

        await mkdir(workspacePath, { recursive: true });
        await writePiConfig(configDir);

        let page: Page;
        ({ app, page } = await launchApp(userDataDir, configDir));
        await prepareWorkspace(page, workspacePath);

        const settingsWindow = await openSettingsWindow(app, page);
        const tablist = settingsWindow.getByRole("tablist", { name: "设置分类" });
        await expect(tablist).toBeVisible();

        await expect(tablist).toHaveCount(1);
        await expect(tablist.getByRole("tab", { name: "模型" })).toHaveCount(1);
        await expect(tablist.getByRole("tab", { name: "Pi Code Agent" })).toHaveCount(1);
        await expect(settingsWindow.getByText("常用")).toBeVisible();
        await expect(settingsWindow.getByText("进阶")).toBeVisible();
        await expect(settingsWindow.getByText("维护")).toBeVisible();

        const tabOrder = await tablist.getByRole("tab").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
        expect(tabOrder).toEqual([
            "通用",
            "模型",
            "Pi Code Agent",
            "界面",
            "权限",
            "用量",
            "长程能力",
            "快捷键",
            "配置文件",
            "关于",
        ]);
        await capture(settingsWindow, "2026-07-01-settings-redesign-v2-01-overview.png");

        await settingsWindow.getByRole("tab", { name: "Pi Code Agent" }).click();
        await expect(settingsWindow.getByRole("tab", { name: "Pi Code Agent" })).toHaveAttribute("aria-selected", "true");
        await expect(settingsWindow.getByText("mimo-v2.5", { exact: true })).toBeVisible();
        await expect(settingsWindow.getByText("MiMo", { exact: true })).toBeVisible();
        await capture(settingsWindow, "2026-07-01-settings-redesign-v2-02-pi-code-agent.png");

        const searchInput = settingsWindow.getByRole("searchbox", { name: "搜索设置..." });
        await searchInput.fill("语言");
        await expect(settingsWindow.getByText("常用")).toHaveCount(0);
        await expect(settingsWindow.getByRole("tab", { name: "通用 · 语言" })).toBeVisible();
        await settingsWindow.getByRole("tab", { name: "通用 · 语言" }).click();
        await expect(settingsWindow.getByRole("heading", { name: "通用" })).toBeVisible();

        await searchInput.fill("Provider");
        await expect(settingsWindow.getByRole("tab", { name: "模型 · Provider / 模型管理" })).toBeVisible();
        await expect(settingsWindow.getByRole("tab", { name: "Pi Code Agent · 默认 Provider / 模型" })).toBeVisible();
        await capture(settingsWindow, "2026-07-01-settings-redesign-v2-03-search-results.png");

        await searchInput.fill("");
        await expect(settingsWindow.getByText("常用")).toBeVisible();
    });
});

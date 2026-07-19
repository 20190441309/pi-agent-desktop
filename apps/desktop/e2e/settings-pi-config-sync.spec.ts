import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { electronMainEntry } from "../playwright.config";
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { getWindowByUrl, hideSettingsWindow, showSettingsWindow } from "./support/electron-windows";

const ACCEPTANCE_DIR = join(__dirname, "..", "..", "..", "docs", "compose", "acceptance");

type PiConfigInput = {
    provider: string;
    providerName: string;
    model: string;
    modelName: string;
    baseUrl: string;
};

async function writePiConfig(configDir: string, config: PiConfigInput): Promise<void> {
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, "settings.json"), JSON.stringify({
        defaultProvider: config.provider,
        defaultModel: config.model,
    }, null, 2), "utf8");
    await writeFile(join(configDir, "models.json"), JSON.stringify({
        providers: {
            [config.provider]: {
                name: config.providerName,
                baseUrl: config.baseUrl,
                api: "openai-completions",
                models: [
                    {
                        id: config.model,
                        name: config.modelName,
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
        const workspace = await window.piAPI.createWorkspace("pi-config-sync", workspacePath);
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
    const settingsWindow = await showSettingsWindow(app, page);
    await expect(settingsWindow.getByRole("tablist", { name: "设置分类" })).toBeVisible();
    return settingsWindow;
}

async function captureAcceptanceScreenshot(page: Page, fileName: string): Promise<void> {
    await mkdir(ACCEPTANCE_DIR, { recursive: true });
    await page.screenshot({
        path: join(ACCEPTANCE_DIR, fileName),
        animations: "disabled",
    });
}

test.describe("Pi Desktop settings / Pi config sync", () => {
    let app: ElectronApplication | undefined;

    test.afterEach(async () => {
        try {
            await app?.close();
        } catch {
            // Ignore Electron shutdown races during cleanup.
        } finally {
            app = undefined;
        }
    });

    test("reopening settings after an external Pi config change refreshes both the settings summary and the main chat model list", async () => {
        const userDataDir = test.info().outputPath(`pi-config-sync-${Date.now()}`);
        const configDir = `${userDataDir}-pi-config`;
        const workspacePath = test.info().outputPath("workspace");
        await mkdir(workspacePath, { recursive: true });

        await writePiConfig(configDir, {
            provider: "mimo",
            providerName: "MiMo",
            model: "mimo-v2.5",
            modelName: "MiMo v2.5",
            baseUrl: "https://mimo.example/v1",
        });

        let page: Page;
        ({ app, page } = await launchApp(userDataDir, configDir));
        await prepareWorkspace(page, workspacePath);

        const modelTrigger = page.getByRole("button", { name: /当前模型:/ });
        await expect(modelTrigger).toBeVisible();
        await expect(modelTrigger).toContainText("mimo-v2.5");

        let settingsWindow = await openSettingsWindow(app, page);
        await settingsWindow.getByRole("tab", { name: "Pi Code Agent" }).click();
        await expect(settingsWindow.getByText("mimo-v2.5")).toBeVisible();
        await captureAcceptanceScreenshot(settingsWindow, "2026-07-01-pi-config-sync-before.png");
        await hideSettingsWindow(app!, settingsWindow);
        await page.bringToFront();

        await writePiConfig(configDir, {
            provider: "longcat",
            providerName: "LongCat",
            model: "longcat-preview",
            modelName: "LongCat Preview",
            baseUrl: "https://longcat.example/v1",
        });

        settingsWindow = await openSettingsWindow(app, page);
        await settingsWindow.getByRole("tab", { name: "Pi Code Agent" }).click();
        await expect(settingsWindow.getByText("longcat-preview")).toBeVisible();
        await captureAcceptanceScreenshot(settingsWindow, "2026-07-01-pi-config-sync-settings-after.png");

        await page.bringToFront();
        await expect(modelTrigger).toContainText("longcat-preview");
        await modelTrigger.click();
        const modelMenu = page.getByRole("menu").filter({ hasText: "选择模型" });
        await expect(modelMenu).toContainText("LongCat Preview");
        await expect(modelMenu).toContainText("LongCat");
        await expect(modelMenu).not.toContainText("mimo-v2.5");
        await captureAcceptanceScreenshot(page, "2026-07-01-pi-config-sync-main-after.png");
    });
});

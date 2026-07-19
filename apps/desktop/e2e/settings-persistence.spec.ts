import { mkdir } from "fs/promises";
import { join } from "path";
import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { electronMainEntry } from "../playwright.config";
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { getWindowByUrl, hideSettingsWindow, showSettingsWindow } from "./support/electron-windows";

const ACCEPTANCE_DIR = join(__dirname, "..", "..", "..", "docs", "compose", "acceptance");

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const configDir = `${userDataDir}-pi-config`;
    await mkdir(configDir, { recursive: true });
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
    return { app, page };
}

async function prepareWorkspace(page: Page, workspacePath: string): Promise<void> {
    await page.evaluate(async ({ workspacePath }) => {
        window.localStorage.setItem("pi-desktop:firstLaunchDone", "true");
        window.localStorage.setItem("pi-desktop.onboarding.completed", "true");
        await window.piAPI.createWorkspace("settings-persistence", workspacePath);
    }, { workspacePath });

    const onboardingModal = page.locator('[data-testid="onboarding-modal"]');
    if (await onboardingModal.count()) {
        await page.getByRole("button", { name: "跳过引导" }).click({ timeout: 5_000 });
        await expect(onboardingModal).toHaveCount(0);
    }
}

async function openSettingsWindow(app: ElectronApplication, page: Page): Promise<Page> {
    const settingsWindow = await showSettingsWindow(app, page);
    await expect(settingsWindow.getByRole("tablist", { name: "设置分类" })).toBeVisible();
    return settingsWindow;
}

async function setFontSize(settingsWindow: Page, value: string): Promise<void> {
    await settingsWindow.getByLabel("字体大小").evaluate((input, nextValue) => {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        valueSetter?.call(input, nextValue);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
}

async function captureAcceptanceScreenshot(page: Page, fileName: string): Promise<void> {
    await mkdir(ACCEPTANCE_DIR, { recursive: true });
    await page.screenshot({
        path: join(ACCEPTANCE_DIR, fileName),
        animations: "disabled",
    });
}

test.describe("settings persistence", () => {
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

    test("settings window and hidden settings persist across reopen and relaunch", async () => {
        const userDataDir = test.info().outputPath(`settings-persistence-${Date.now()}`);
        const workspacePath = test.info().outputPath("workspace");
        await mkdir(workspacePath, { recursive: true });

        let page: Page;
        ({ app, page } = await launchApp(userDataDir));
        await prepareWorkspace(page, workspacePath);

        let settingsWindow = await openSettingsWindow(app, page);

        await settingsWindow.getByRole("tab", { name: "界面" }).click();
        await settingsWindow.getByRole("button", { name: "深色" }).click();
        await expect(settingsWindow.locator("html")).toHaveAttribute("data-theme", "dark");
        await setFontSize(settingsWindow, "18");
        await expect(settingsWindow.getByText("字体大小: 18px")).toBeVisible();

        await settingsWindow.getByRole("tab", { name: "长程能力" }).click();
        const goalSwitch = settingsWindow.getByRole("switch", { name: "Goal / 停止条件" });
        const initialGoalState = await goalSwitch.getAttribute("aria-checked");
        const targetGoalState = initialGoalState === "true" ? "false" : "true";
        await goalSwitch.click();
        await expect(goalSwitch).toHaveAttribute("aria-checked", targetGoalState);

        await settingsWindow.evaluate(async () => {
            await window.piAPI.setSettings({
                showThinking: false,
                thinkingLevel: "high",
                visionProvider: "minimax",
                visionModel: "MiniMax-VL",
            });
        });

        await captureAcceptanceScreenshot(settingsWindow, "2026-06-24-m4-01.png");

        await hideSettingsWindow(app!, settingsWindow);
        await page.bringToFront();

        settingsWindow = await openSettingsWindow(app, page);
        await settingsWindow.getByRole("tab", { name: "界面" }).click();
        await expect(settingsWindow.locator("html")).toHaveAttribute("data-theme", "dark");
        await expect(settingsWindow.getByText("字体大小: 18px")).toBeVisible();
        await captureAcceptanceScreenshot(settingsWindow, "2026-06-24-m4-02.png");

        await settingsWindow.getByRole("tab", { name: "长程能力" }).click();
        await expect(settingsWindow.getByRole("switch", { name: "Goal / 停止条件" })).toHaveAttribute("aria-checked", targetGoalState);
        let persisted = await settingsWindow.evaluate(async () => await window.piAPI.getSettings());
        expect(persisted).toEqual(expect.objectContaining({
            showThinking: false,
            thinkingLevel: "high",
            visionProvider: "minimax",
            visionModel: "MiniMax-VL",
        }));

        await app.close();
        app = undefined;

        ({ app, page } = await launchApp(userDataDir));
        await prepareWorkspace(page, workspacePath);
        settingsWindow = await openSettingsWindow(app, page);
        await settingsWindow.getByRole("tab", { name: "界面" }).click();
        await expect(settingsWindow.locator("html")).toHaveAttribute("data-theme", "dark");
        await expect(settingsWindow.getByText("字体大小: 18px")).toBeVisible();
        await settingsWindow.getByRole("tab", { name: "长程能力" }).click();
        await expect(settingsWindow.getByRole("switch", { name: "Goal / 停止条件" })).toHaveAttribute("aria-checked", targetGoalState);
        persisted = await settingsWindow.evaluate(async () => await window.piAPI.getSettings());
        expect(persisted).toEqual(expect.objectContaining({
            showThinking: false,
            thinkingLevel: "high",
            visionProvider: "minimax",
            visionModel: "MiniMax-VL",
        }));
        await captureAcceptanceScreenshot(settingsWindow, "2026-06-24-m4-03.png");
    });
});

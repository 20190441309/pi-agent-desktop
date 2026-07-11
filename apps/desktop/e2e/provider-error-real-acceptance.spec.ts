import { test, expect, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { electronMainEntry } from "../playwright.config";
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { getWindowByUrl } from "./support/electron-windows";
import { join } from "path";
import { mkdirSync, writeFileSync } from "fs";

const ACCEPTANCE_DIR = join(__dirname, "..", "..", "..", "docs", "compose", "acceptance");
const INVALID_KEY_ENV = "PI_DESKTOP_DEEP_API_KEY";

function writeInvalidProviderConfig(configDir: string): void {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "models.json"), JSON.stringify({
        providers: {
            longcat: {
                name: "LongCat",
                baseUrl: "https://api.longcat.chat/openai",
                apiKey: INVALID_KEY_ENV,
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
            [INVALID_KEY_ENV]: "codex-invalid-key-for-provider-error-acceptance",
        },
    });
    const page = await getWindowByUrl(app, "index.html");
    await page.waitForLoadState("domcontentloaded");
    return { app, page };
}

async function skipOnboarding(page: Page): Promise<void> {
    const modal = page.locator('[data-testid="onboarding-modal"]');
    if (await modal.count() === 0) return;
    await page.getByRole("button", { name: "跳过引导" }).click({ timeout: 5_000 });
    await expect(modal).toHaveCount(0, { timeout: 5_000 });
}

test.describe("Pi Desktop real provider error acceptance", () => {
    let app: ElectronApplication | undefined;

    test.setTimeout(180_000);

    test.afterEach(async () => {
        try {
            await app?.close();
        } catch {
            // ignore cleanup failures
        } finally {
            app = undefined;
        }
    });

    test("first-turn real provider auth errors stay user-visible instead of degrading into fake success", async () => {
        mkdirSync(ACCEPTANCE_DIR, { recursive: true });
        const userDataDir = test.info().outputPath(`provider-error-real-${Date.now()}`);
        const configDir = test.info().outputPath(`provider-error-config-${Date.now()}`);
        const workspacePath = test.info().outputPath("provider-error-workspace");
        writeInvalidProviderConfig(configDir);

        let page: Page;
        ({ app, page } = await launchApp(userDataDir, configDir));
        await skipOnboarding(page);

        await page.evaluate(async ({ workspacePath }) => {
            window.localStorage.setItem("pi-desktop:firstLaunchDone", "true");
            window.localStorage.setItem("pi-desktop.onboarding.completed", "true");
            const workspace = await window.piAPI.createWorkspace("provider-error-real", workspacePath);
            await window.piAPI.selectWorkspace(workspace.path);
            await window.piAPI.setSettings({
                provider: "longcat",
                model: "LongCat-2.0-Preview",
            });
        }, { workspacePath });

        const textarea = page.locator('textarea[aria-label="发送"]').first();
        await expect(textarea).toBeVisible({ timeout: 10_000 });
        await textarea.fill("请回复一句 hello");
        await textarea.press("Enter");

        await expect(page.getByRole("article", { name: /你 ·/ })).toContainText("请回复一句 hello", { timeout: 10_000 });

        const providerAlert = page.getByRole("alert").filter({
            hasText: /LongCat|longcat|401|403|Unauthorized|forbidden|invalid/i,
        }).first();
        await expect(providerAlert).toBeVisible({ timeout: 60_000 });
        await expect(providerAlert).not.toContainText("Pi 本轮没有返回内容");
        await page.screenshot({ path: join(ACCEPTANCE_DIR, "2026-06-27-provider-error-real-first-turn.png"), fullPage: true });
    });
});

/**
 * Third-Party Model Configuration Test
 * 测试 Pi Desktop 配置第三方模型的完整流程
 *
 * 步骤:
 *   1. 打开设置 → 配置中心
 *   2. 编辑 models.json 添加新 Provider
 *   3. 编辑 auth.json 添加 API Key
 *   4. 保存配置
 *   5. 验证配置持久化
 *   6. 测试连接（可选）
 */
import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';
import { mkdir } from 'fs/promises';

const TEST_TIMEOUT = 60_000;

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const configDir = `${userDataDir}-pi-config`;
    await mkdir(configDir, { recursive: true });
    const app = await _electron.launch({
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: {
            ...process.env,
            CI: '1',
            ELECTRON_RENDERER_URL: '',
            PI_DESKTOP_CONFIG_DIR: configDir,
        },
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // Skip onboarding
    const modalCount = await page.locator('[data-testid="onboarding-modal"]').count();
    if (modalCount > 0) {
        await page.getByRole('button', { name: '跳过引导' }).click({ timeout: 5000 });
        await page.waitForFunction(
            () => document.querySelector('[data-testid="onboarding-modal"]') === null,
            { timeout: 5000 }
        );
    }
    return { app, page };
}

async function openConfigWindow(app: ElectronApplication, page: Page): Promise<Page> {
    const settingsWindowPromise = app.waitForEvent('window');
    await page.getByRole('button', { name: '打开设置窗口' }).click();
    const settingsWindow = await settingsWindowPromise;
    await settingsWindow.waitForLoadState('domcontentloaded');
    await settingsWindow.getByRole('tab', { name: '配置文件' }).click();
    await expect(settingsWindow.getByRole('tab', { name: '配置文件' })).toHaveAttribute('aria-selected', 'true');
    return settingsWindow;
}

test.describe('Pi Desktop — Third-Party Model Configuration', () => {
    test.setTimeout(TEST_TIMEOUT);

    // ===== Test 1: 通过配置中心编辑 models.json =====
    test('config center: add a third-party provider to models.json', async () => {
        const userDataDir = test.info().outputPath(`config-models-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        const settingsWindow = await openConfigWindow(app, page);

        // Step 3: Verify config editor is visible
        const configEditor = settingsWindow.locator('textarea[aria-label="Pi 配置 JSON"]');
        await expect(configEditor).toBeVisible({ timeout: 5000 });

        // Step 4: Get current models.json content
        const initialRaw = await configEditor.inputValue();
        console.log(`[TEST] Initial models.json: ${initialRaw.slice(0, 200)}...`);

        // Step 5: Write new models.json with a third-party provider
        const testProvider = {
            providers: {
                openrouter: {
                    name: "OpenRouter",
                    baseUrl: "https://openrouter.ai/api/v1",
                    apiType: "openai",
                    models: [
                        { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (OpenRouter)" },
                        { id: "openai/gpt-4o", name: "GPT-4o (OpenRouter)" }
                    ]
                }
            }
        };

        await configEditor.fill(JSON.stringify(testProvider, null, 2));
        await settingsWindow.waitForTimeout(200);

        // Step 6: Save the configuration
        const saveBtn = settingsWindow.locator('button:has-text("保存当前文件")');
        await saveBtn.click();
        await settingsWindow.waitForTimeout(500);

        // Step 7: Verify save success message
        const successMessage = settingsWindow.locator('text=已保存');
        await expect(successMessage).toBeVisible({ timeout: 5000 });
        console.log('[TEST] models.json saved successfully');

        await app.close();
    });

    // ===== Test 2: 通过配置中心编辑 auth.json =====
    test('config center: add API key to auth.json', async () => {
        const userDataDir = test.info().outputPath(`config-auth-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        const settingsWindow = await openConfigWindow(app, page);

        // Switch to auth.json
        const authBtn = settingsWindow.locator('button:has-text("auth.json")');
        await authBtn.click();
        await settingsWindow.waitForTimeout(300);

        // Verify auth.json editor
        const configEditor = settingsWindow.locator('textarea[aria-label="Pi 配置 JSON"]');
        await expect(configEditor).toBeVisible({ timeout: 5000 });

        // Write auth config with API key
        const authConfig = {
            openrouter: {
                apiKey: "sk-or-v1-test-api-key-123456789"
            }
        };

        await configEditor.fill(JSON.stringify(authConfig, null, 2));
        await settingsWindow.waitForTimeout(200);

        // Save
        const saveBtn = settingsWindow.locator('button:has-text("保存当前文件")');
        await saveBtn.click();
        await settingsWindow.waitForTimeout(500);

        // Verify save success
        const successMessage = settingsWindow.locator('text=已保存');
        await expect(successMessage).toBeVisible({ timeout: 5000 });
        console.log('[TEST] auth.json saved successfully');

        await app.close();
    });

    // ===== Test 3: 完整的端到端配置流程 =====
    test('full config flow: models + auth + verify via IPC', async () => {
        const userDataDir = test.info().outputPath(`config-full-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        const settingsWindow = await openConfigWindow(app, page);

        const configEditor = settingsWindow.locator('textarea[aria-label="Pi 配置 JSON"]');

        // Configure models.json
        const modelsConfig = {
            providers: {
                custom_provider: {
                    name: "Custom AI Provider",
                    baseUrl: "https://api.custom-ai.com/v1",
                    apiType: "openai",
                    models: [
                        { id: "custom-model-v1", name: "Custom Model V1" }
                    ]
                }
            }
        };
        await configEditor.fill(JSON.stringify(modelsConfig, null, 2));
        await settingsWindow.locator('button:has-text("保存当前文件")').click();
        await settingsWindow.waitForTimeout(500);

        // Switch to auth.json
        await settingsWindow.locator('button:has-text("auth.json")').click();
        await settingsWindow.waitForTimeout(300);

        // Configure auth
        const authConfig = {
            custom_provider: {
                apiKey: "sk-custom-test-key-12345"
            }
        };
        await configEditor.fill(JSON.stringify(authConfig, null, 2));
        await settingsWindow.locator('button:has-text("保存当前文件")').click();
        await settingsWindow.waitForTimeout(500);

        // Close settings
        const settingsClosed = settingsWindow.waitForEvent('close');
        await settingsWindow.getByRole('button', { name: '关闭窗口' }).click();
        await settingsClosed;
        await page.bringToFront();

        // Step 4: Verify via IPC API
        const models = await page.evaluate(async () => {
            const result = await window.piAPI.configGetModels();
            return result.parsed;
        });

        expect(models).toBeTruthy();
        expect(models.providers).toBeTruthy();
        expect(models.providers.custom_provider).toBeTruthy();
        expect(models.providers.custom_provider.name).toBe('Custom AI Provider');
        expect(models.providers.custom_provider.baseUrl).toBe('https://api.custom-ai.com/v1');
        expect(models.providers.custom_provider.models).toHaveLength(1);
        expect(models.providers.custom_provider.models[0].id).toBe('custom-model-v1');

        console.log(`[TEST] Verified models config: provider=${models.providers.custom_provider.name}`);

        // Verify auth
        const auth = await page.evaluate(async () => {
            const result = await window.piAPI.configGetAuth();
            return result.parsed;
        });

        expect(auth).toBeTruthy();
        expect(auth.custom_provider).toBeTruthy();
        expect(auth.custom_provider.apiKey).toBe('sk-custom-test-key-12345');

        console.log('[TEST] Verified auth config: API key saved correctly');

        await app.close();
    });

    // ===== Test 4: 验证 getFullConfig 返回新配置的 Provider =====
    test('getFullConfig API returns configured providers', async () => {
        const userDataDir = test.info().outputPath(`config-display-${Date.now()}`);
        const { app, page } = await launchApp(userDataDir);

        // Pre-configure via IPC with multiple providers
        await page.evaluate(async () => {
            await window.piAPI.configSaveRaw('models.json', JSON.stringify({
                providers: {
                    provider_a: {
                        name: "Provider A",
                        baseUrl: "https://a.example.com/v1",
                        models: [{ id: "model-a", name: "Model A" }]
                    },
                    provider_b: {
                        name: "Provider B",
                        baseUrl: "https://b.example.com/v1",
                        models: [{ id: "model-b", name: "Model B" }]
                    }
                }
            }));
            await window.piAPI.configSaveRaw('settings.json', JSON.stringify({
                defaultProvider: "provider_a",
                defaultModel: "model-a"
            }));
        });

        // Verify via getFullConfig API
        const fullConfig = await page.evaluate(async () => {
            return await window.piAPI.getFullConfig();
        });

        expect(fullConfig).toBeTruthy();
        expect(fullConfig.providers.length).toBeGreaterThanOrEqual(2);

        const providerA = fullConfig.providers.find((p: { id: string }) => p.id === 'provider_a');
        expect(providerA).toBeTruthy();
        expect(providerA.name).toBe('Provider A');
        expect(providerA.modelCount).toBe(1);

        const providerB = fullConfig.providers.find((p: { id: string }) => p.id === 'provider_b');
        expect(providerB).toBeTruthy();
        expect(providerB.name).toBe('Provider B');

        console.log(`[TEST] getFullConfig returned ${fullConfig.providers.length} providers, found Provider A and B`);

        await app.close();
    });
});

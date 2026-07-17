/**
 * Deep Interactive Test: Pi Desktop 核心 AI 对话测试
 *
 * 测试内容:
 * 1. 启动应用并配置模型 (provider + model + apiKey)
 * 2. 创建 workspace 和 session
 * 3. 发送真实消息给 AI
 * 4. 观察流式响应、工具调用、文件输出
 * 5. 验证 AI 能完成一个小任务（如创建计算器组件）
 *
 * 关键 DOM 结构（从错误上下文获取）:
 * - 用户消息: article[aria-label^="你 ·"] 包含 timestamp + text
 * - AI 思考中: status "Pi 正在思考..."
 * - AI 回复: article[aria-label^="Pi ·"] 或 article 不含 "你"
 * - 输入框: textarea[aria-label="发送"]
 * - 模型选择: button "选择模型"
 * - 状态: text "任务运行中" / "idle"
 */
import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { getWindowByUrl } from "./support/electron-windows";
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const TEST_TIMEOUT = 300_000; // 5 minutes for real AI responses
const SCREENSHOT_DIR = join(__dirname, '..', 'e2e-output', 'deep-interactive');
const DEEP_API_KEY_ENV = 'PI_DESKTOP_DEEP_API_KEY';

interface DeepProviderConfig {
    provider: string;
    providerName: string;
    model: string;
    modelName: string;
    baseUrl: string;
    api: string;
    apiKeyEnv?: string;
    apiKeyValue?: string;
    contextWindow: number;
    maxTokens: number;
}

const DEEP_CONFIG = resolveDeepProviderConfig();
const deepInteractiveDescribe = process.env.RUN_DEEP_INTERACTIVE === '1' && DEEP_CONFIG
    ? test.describe
    : test.describe.skip;

interface DeepAppContext {
    app: ElectronApplication;
    page: Page;
    workspacePath: string;
    configDir: string;
}

function writeDeepConfig(configDir: string): void {
    const config = requireDeepConfig();
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'models.json'), JSON.stringify({
        providers: {
            [config.provider]: {
                name: config.providerName,
                baseUrl: config.baseUrl,
                apiKey: config.apiKeyEnv,
                api: config.api,
                models: [{
                    id: config.model,
                    name: config.modelName,
                    reasoning: false,
                    input: ['text'],
                    contextWindow: config.contextWindow,
                    maxTokens: config.maxTokens,
                }],
            },
        },
    }, null, 2), 'utf8');
    writeFileSync(join(configDir, 'settings.json'), JSON.stringify({
        defaultProvider: config.provider,
        defaultModel: config.model,
    }, null, 2), 'utf8');
}

function requireDeepConfig(): DeepProviderConfig {
    if (!DEEP_CONFIG) throw new Error('No deep interactive provider config available');
    return DEEP_CONFIG;
}

function resolveDeepProviderConfig(): DeepProviderConfig | null {
    if (process.env.PI_DESKTOP_DEEP_USE_CURRENT_PROVIDER === '1') {
        const current = readCurrentProviderConfig();
        if (current) return current;
    }
    const longCatKey = process.env.LONGCAT_API_KEY ?? readLocalLongCatApiKey();
    if (longCatKey) {
        return {
            provider: 'longcat',
            providerName: 'LongCat',
            model: 'LongCat-2.0-Preview',
            modelName: 'LongCat 2.0 Preview',
            baseUrl: 'https://api.longcat.chat/openai',
            api: 'openai-completions',
            apiKeyEnv: DEEP_API_KEY_ENV,
            apiKeyValue: longCatKey,
            contextWindow: 128000,
            maxTokens: 4096,
        };
    }

    if (process.env.ANTHROPIC_API_KEY) {
        return {
            provider: 'anthropic',
            providerName: 'Anthropic',
            model: 'claude-sonnet-4-20250514',
            modelName: 'Claude Sonnet 4',
            baseUrl: 'https://api.anthropic.com',
            api: 'anthropic-messages',
            contextWindow: 200000,
            maxTokens: 4096,
        };
    }

    return null;
}

function readCurrentProviderConfig(): DeepProviderConfig | null {
    try {
        const configDir = join(process.env.USERPROFILE ?? '', '.pi', 'agent');
        const settings = JSON.parse(readFileSync(join(configDir, 'settings.json'), 'utf8')) as { defaultProvider?: string; defaultModel?: string };
        const models = JSON.parse(readFileSync(join(configDir, 'models.json'), 'utf8')) as { providers?: Record<string, { name?: string; baseUrl?: string; api?: string; apiKey?: string; models?: Array<{ id: string; name?: string; contextWindow?: number; maxTokens?: number }> }> };
        const auth = JSON.parse(readFileSync(join(configDir, 'auth.json'), 'utf8')) as Record<string, { key?: string; apiKey?: string }>;
        const providerId = settings.defaultProvider;
        const modelId = settings.defaultModel;
        if (!providerId || !modelId) return null;
        const provider = models.providers?.[providerId];
        const model = provider?.models?.find((item) => item.id === modelId);
        const recoveredAuth = auth[providerId] ?? auth[`${providerId}_ispure`] ?? auth[`${providerId}_legacy`];
        const apiKey = provider?.apiKey ?? recoveredAuth?.key ?? recoveredAuth?.apiKey;
        if (!provider?.baseUrl || !provider.api || !model || !apiKey) return null;
        return {
            provider: providerId,
            providerName: provider.name ?? providerId,
            model: modelId,
            modelName: model.name ?? modelId,
            baseUrl: provider.baseUrl,
            api: provider.api,
            apiKeyEnv: DEEP_API_KEY_ENV,
            apiKeyValue: apiKey,
            contextWindow: model.contextWindow ?? 128000,
            maxTokens: model.maxTokens ?? 4096,
        };
    } catch {
        return null;
    }
}

function readLocalLongCatApiKey(): string | undefined {
    try {
        const authPath = join(process.env.USERPROFILE ?? '', '.pi', 'agent', 'auth.json');
        if (!authPath || !existsSync(authPath)) return undefined;
        const auth = JSON.parse(readFileSync(authPath, 'utf8')) as { longcat?: { key?: string; apiKey?: string } };
        return auth.longcat?.key ?? auth.longcat?.apiKey;
    } catch {
        return undefined;
    }
}

function writeDeepWorkspace(workspacePath: string): void {
    mkdirSync(workspacePath, { recursive: true });
    writeFileSync(join(workspacePath, 'package.json'), JSON.stringify({
        name: 'pi-desktop-deep-e2e-workspace',
        version: '0.0.0',
        private: true,
        description: 'Temporary workspace for Pi Desktop deep interactive E2E',
    }, null, 2), 'utf8');
}

async function launchApp(): Promise<DeepAppContext> {
    const deepConfig = requireDeepConfig();
    const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const configDir = test.info().outputPath(`pi-agent-config-${Date.now()}`);
    const workspacePath = test.info().outputPath(`workspace-${Date.now()}`);
    writeDeepConfig(configDir);
    writeDeepWorkspace(workspacePath);

    const app = await _electron.launch({
        executablePath: resolveElectronExecutablePath(),
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: {
            ...process.env,
            CI: '1',
            ELECTRON_RENDERER_URL: '',
            PI_DESKTOP_CONFIG_DIR: configDir,
            ...(deepConfig.apiKeyValue ? { [DEEP_API_KEY_ENV]: deepConfig.apiKeyValue } : {}),
        },
    });
    const page = await getWindowByUrl(app, "index.html");
    await page.waitForLoadState('domcontentloaded');

    // Skip onboarding if present
    const modalCount = await page.locator('[data-testid="onboarding-modal"]').count();
    if (modalCount > 0) {
        await page.getByRole('button', { name: '跳过引导' }).click({ timeout: 5000 });
        await page.waitForFunction(
            () => document.querySelector('[data-testid="onboarding-modal"]') === null,
            { timeout: 5000 }
        );
    }
    await page.evaluate(async ({ workspacePath, provider, model }) => {
        window.localStorage.setItem('pi-desktop:firstLaunchDone', 'true');
        window.localStorage.setItem('pi-desktop.onboarding.completed', 'true');
        const workspace = await window.piAPI.createWorkspace('deep-interactive-e2e', workspacePath);
        if (!workspace || !('id' in workspace)) throw new Error('Failed to create deep interactive workspace');
        await window.piAPI.selectWorkspace(workspace.path);
        await window.piAPI.setSettings({ provider, model });
    }, { workspacePath, provider: deepConfig.provider, model: deepConfig.model });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    return { app, page, workspacePath, configDir };
}

async function takeScreenshot(page: Page, name: string): Promise<void> {
    const path = join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path });
    console.log(`[DEEP-TEST] Screenshot: ${name}`);
}

async function waitForAiResponse(page: Page, initialCount: number, timeout = 120_000): Promise<void> {
    const deadline = Date.now() + timeout;
    const articles = page.locator('article');
    const failure = page.getByRole('alert').filter({ hasText: '发送失败' }).first();

    while (Date.now() < deadline) {
        if (await failure.isVisible().catch(() => false)) {
            const text = (await failure.textContent())?.replace(/\s+/g, ' ').trim();
            throw new Error(`AI response failed: ${text ?? '发送失败'}`);
        }
        if (await articles.count() > initialCount) return;
        await page.waitForTimeout(1000);
    }

    throw new Error(`Timed out waiting for AI response after ${timeout}ms`);
}

async function waitForRunToFinish(page: Page, timeout = 180_000): Promise<void> {
    const deadline = Date.now() + timeout;
    const stopButton = page.getByRole('button', { name: '停止生成' });
    const failure = page.getByRole('alert').filter({ hasText: '发送失败' }).first();

    while (Date.now() < deadline) {
        if (await failure.isVisible().catch(() => false)) {
            const text = (await failure.textContent())?.replace(/\s+/g, ' ').trim();
            throw new Error(`AI run failed: ${text ?? '发送失败'}`);
        }
        if (!(await stopButton.isVisible().catch(() => false))) return;
        await page.waitForTimeout(1000);
    }

    throw new Error(`Timed out waiting for AI run to finish after ${timeout}ms`);
}

deepInteractiveDescribe('Pi Desktop — Deep AI Interaction', () => {
    let app: ElectronApplication;
    let page: Page;

    test.setTimeout(TEST_TIMEOUT);

    test.beforeAll(() => {
        mkdirSync(SCREENSHOT_DIR, { recursive: true });
    });

    test.afterEach(async () => {
        try { await app?.close(); } catch { /* ignore */ }
    });

    test('1. 配置模型设置', async () => {
        const deepConfig = requireDeepConfig();
        ({ app, page } = await launchApp());
        await takeScreenshot(page, '01-launch');

        const settingsWindowPromise = app.waitForEvent('window');
        await page.getByRole('tab', { name: '设置' }).click();
        const settingsWindow = await settingsWindowPromise;
        await settingsWindow.waitForLoadState('domcontentloaded');

        await expect(settingsWindow.getByRole('tablist', { name: '设置分类' })).toBeVisible({ timeout: 5000 });
        await takeScreenshot(settingsWindow, '02-settings-opened');

        await settingsWindow.getByRole('tab', { name: '模型' }).click();
        await expect(settingsWindow.getByRole('tab', { name: '模型' })).toHaveAttribute('aria-selected', 'true');
        await expect(settingsWindow.getByText(deepConfig.modelName)).toBeVisible({ timeout: 10_000 });
        await settingsWindow.waitForTimeout(500);
        await takeScreenshot(settingsWindow, '03-settings-model-tab');

        const settingsClosed = settingsWindow.waitForEvent('close');
        await settingsWindow.getByRole('button', { name: '关闭窗口' }).click();
        await settingsClosed;
        await page.bringToFront();
        await page.waitForTimeout(300);
        await takeScreenshot(page, '04-settings-closed');

        console.log('[DEEP-TEST] Model settings configured');
    });

    test('2. 创建新会话并发送简单消息，观察 AI 流式响应', async () => {
        ({ app, page } = await launchApp());
        await takeScreenshot(page, '10-ready-for-chat');

        // Find textarea - use exact aria-label from DOM snapshot
        const textarea = page.locator('textarea[aria-label="发送"]');
        await expect(textarea).toBeVisible({ timeout: 5000 });

        // Type a simple greeting
        await textarea.fill('你好，请用一句话介绍你自己');
        await takeScreenshot(page, '11-message-typed');

        // Send message
        await textarea.press('Enter');
        console.log('[DEEP-TEST] Message sent, waiting for user message to appear...');
        await takeScreenshot(page, '12-message-sent');

        // Wait for user message to appear - correct locator from DOM snapshot
        // article aria-label starts with "你 ·"
        const userArticle = page.locator('article[aria-label^="你 ·"]').first();
        await expect(userArticle).toBeVisible({ timeout: 10_000 });
        const userText = await userArticle.textContent();
        expect(userText).toContain('你好，请用一句话介绍你自己');
        console.log('[DEEP-TEST] User message confirmed in chat');
        await takeScreenshot(page, '13-user-message-visible');

        // Wait for AI "thinking" status to appear (indicates AI is processing)
        const thinkingStatus = page.locator('status:has-text("Pi 正在思考")').or(
            page.getByText('Pi 正在思考')
        ).first();
        const isThinking = await thinkingStatus.isVisible().catch(() => false);
        if (isThinking) {
            console.log('[DEEP-TEST] AI is thinking...');
            await takeScreenshot(page, '14-ai-thinking');
        }

        // Wait for AI response - article NOT starting with "你 ·" (so it's AI)
        // Or wait for any new article after user message
        const allArticles = page.locator('article');
        await waitForAiResponse(page, 1);
        console.log('[DEEP-TEST] AI response appeared');
        await takeScreenshot(page, '15-ai-response-received');

        // Get all message texts
        const messages = await allArticles.allTextContents();
        console.log(`[DEEP-TEST] Messages in chat (${messages.length}):`);
        messages.forEach((msg, i) => {
            const preview = msg.replace(/\s+/g, ' ').slice(0, 80);
            console.log(`  [${i}] ${preview}...`);
        });
    });

    test('2b. Compose 模式隐藏内部上下文并返回真实助手回复', async () => {
        test.setTimeout(TEST_TIMEOUT);
        const { app, page } = await launchApp();
        try {
            const modeTrigger = page.getByRole('button', { name: '选择 Agent 模式' });
            await expect(modeTrigger).toBeVisible({ timeout: 10_000 });
            await modeTrigger.click();
            const modeMenu = page.getByRole('menu', { name: 'Agent 模式' });
            await expect(modeMenu).toBeVisible();
            await modeMenu.getByRole('menuitemradio', { name: /Compose/ }).click();
            await expect(modeTrigger).toContainText('Compose');

            const textarea = page.locator('textarea[aria-label*="发送" i]').first();
            const initialCount = await page.locator('article').count();
            await textarea.fill('请只用一句中文回复：COMPOSE_OK');
            await textarea.press('Enter');
            await waitForAiResponse(page, initialCount);
            await waitForRunToFinish(page);

            await expect(page.getByText(/Compose runtime is active/i)).toHaveCount(0);
            await expect(page.getByText(/This is the first compose-guided turn/i)).toHaveCount(0);
            await expect(page.getByRole('article', { name: /Pi ·/ }).last()).toContainText(/COMPOSE_OK/i);
        } finally {
            await app.close();
        }
    });

    test('3. 让 AI 创建一个小项目（计算器组件）', async () => {
        const context = await launchApp();
        ({ app, page } = context);
        await takeScreenshot(page, '20-ready-for-project');

        const textarea = page.locator('textarea[aria-label="发送"]');
        await expect(textarea).toBeVisible({ timeout: 5000 });

        const prompt = '请创建一个简单的 HTML+CSS+JS 计算器，保存到 calc.html 文件中。只需要基本功能：加减乘除。';
        await textarea.fill(prompt);
        await takeScreenshot(page, '21-project-prompt-typed');

        await textarea.press('Enter');
        console.log('[DEEP-TEST] Project prompt sent...');
        await takeScreenshot(page, '22-project-prompt-sent');

        // Wait for user message
        const userArticle = page.locator('article[aria-label^="你 ·"]').first();
        await expect(userArticle).toBeVisible({ timeout: 10_000 });
        const userText = await userArticle.textContent();
        expect(userText).toContain('计算器');
        console.log('[DEEP-TEST] User project request confirmed');

        // Wait for AI to start responding (more articles appear)
        const allArticles = page.locator('article');
        const initialCount = await allArticles.count();
        await waitForAiResponse(page, initialCount);
        console.log('[DEEP-TEST] AI started responding');
        await takeScreenshot(page, '23-project-response-started');

        // Wait for the real run to finish; article creation alone can happen while tools are still queued.
        await waitForRunToFinish(page);
        console.log('[DEEP-TEST] Task completed');
        await takeScreenshot(page, '24-project-complete');

        // Check if calc.html was created
        const pageText = await page.textContent('body');
        const hasCalcFile = pageText?.includes('calc.html') ?? false;
        console.log(`[DEEP-TEST] calc.html mentioned in output: ${hasCalcFile}`);
        expect(existsSync(join(context.workspacePath, 'calc.html'))).toBe(true);

        // Get final messages
        const messages = await allArticles.allTextContents();
        console.log(`[DEEP-TEST] Final messages (${messages.length}):`);
        messages.forEach((msg, i) => {
            const preview = msg.replace(/\s+/g, ' ').slice(0, 100);
            console.log(`  [${i}] ${preview}...`);
        });
    });

    test('4. 观察流式输出和工具权限交互', async () => {
        ({ app, page } = await launchApp());
        await takeScreenshot(page, '30-ready-for-streaming');

        const textarea = page.locator('textarea[aria-label="发送"]');
        await expect(textarea).toBeVisible({ timeout: 5000 });

        const prompt = '请查看当前目录下的 package.json 文件，告诉我项目名称是什么';
        await textarea.fill(prompt);
        await textarea.press('Enter');
        console.log('[DEEP-TEST] Read request sent...');
        await takeScreenshot(page, '31-read-request-sent');

        // Wait for user message
        const userArticle = page.locator('article[aria-label^="你 ·"]').first();
        await expect(userArticle).toBeVisible({ timeout: 10_000 });

        // Wait for AI response
        const allArticles = page.locator('article');
        const initialCount = await allArticles.count();
        await waitForAiResponse(page, initialCount);
        console.log('[DEEP-TEST] AI responded');
        await waitForRunToFinish(page);
        await takeScreenshot(page, '32-read-response-received');

        // Check if "Pi 正在思考" appeared (tool call in progress)
        const thinkingIndicator = page.getByText('Pi 正在思考').first();
        const hadThinking = await thinkingIndicator.isVisible().catch(() => false);
        console.log(`[DEEP-TEST] AI had thinking phase: ${hadThinking}`);

        // Get final response text (last article)
        const articles = await allArticles.all();
        const lastArticle = articles[articles.length - 1];
        const responseText = await lastArticle.textContent();
        console.log(`[DEEP-TEST] Final AI response: ${responseText?.slice(0, 150)}...`);

        // Check if project name from the isolated temporary workspace is mentioned.
        const hasProjectName = responseText?.toLowerCase().includes('pi-desktop-deep-e2e-workspace') ?? false;
        console.log(`[DEEP-TEST] Detected project name: ${hasProjectName}`);
        expect(hasProjectName).toBe(true);

        await takeScreenshot(page, '33-read-test-complete');
    });
});

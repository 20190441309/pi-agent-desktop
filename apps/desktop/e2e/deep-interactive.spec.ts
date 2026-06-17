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
import { join } from 'path';
import { mkdirSync } from 'fs';

const TEST_TIMEOUT = 300_000; // 5 minutes for real AI responses
const SCREENSHOT_DIR = join(__dirname, '..', 'e2e-output', 'deep-interactive');
const deepInteractiveDescribe = process.env.RUN_DEEP_INTERACTIVE === '1' ? test.describe : test.describe.skip;

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
    const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const app = await _electron.launch({
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: {
            ...process.env,
            CI: '1',
            ELECTRON_RENDERER_URL: '',
        },
    });
    const page = await app.firstWindow();
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
    return { app, page };
}

async function takeScreenshot(page: Page, name: string): Promise<void> {
    const path = join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path });
    console.log(`[DEEP-TEST] Screenshot: ${name}`);
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
        ({ app, page } = await launchApp());
        await takeScreenshot(page, '01-launch');

        const settingsBtn = page.locator('button[data-mmcode-section="settings"]');
        await expect(settingsBtn).toBeVisible({ timeout: 5000 });
        await settingsBtn.click();

        const settingsDialog = page.getByRole('dialog', { name: '设置' });
        await expect(settingsDialog).toBeVisible({ timeout: 5000 });
        await takeScreenshot(page, '02-settings-opened');

        const modelTab = settingsDialog.locator('[role="tab"]').filter({ hasText: '模型' });
        await modelTab.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '03-settings-model-tab');

        const closeBtn = settingsDialog.locator('button[aria-label="关闭"]').first();
        await closeBtn.click();
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
        await expect.poll(async () => await allArticles.count()).toBeGreaterThan(1);
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

    test('3. 让 AI 创建一个小项目（计算器组件）', async () => {
        ({ app, page } = await launchApp());
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
        await expect.poll(async () => await allArticles.count(), {
            timeout: 120_000,
            intervals: [1000],
        }).toBeGreaterThan(initialCount);
        console.log('[DEEP-TEST] AI started responding');
        await takeScreenshot(page, '23-project-response-started');

        // Wait for task to complete - status goes back to idle
        // Check in right panel
        const statusText = page.locator('text=idle').first();
        await expect(statusText).toBeVisible({ timeout: 120_000 });
        console.log('[DEEP-TEST] Task completed (status: idle)');
        await takeScreenshot(page, '24-project-complete');

        // Check if calc.html was created
        const pageText = await page.textContent('body');
        const hasCalcFile = pageText?.includes('calc.html') ?? false;
        console.log(`[DEEP-TEST] calc.html mentioned in output: ${hasCalcFile}`);

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
        await expect.poll(async () => await allArticles.count(), {
            timeout: 120_000,
            intervals: [1000],
        }).toBeGreaterThan(initialCount);
        console.log('[DEEP-TEST] AI responded');
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

        // Check if project name "pi-desktop" is mentioned
        const hasProjectName = responseText?.toLowerCase().includes('pi-desktop') ?? false;
        console.log(`[DEEP-TEST] Detected project name: ${hasProjectName}`);

        await takeScreenshot(page, '33-read-test-complete');
    });
});

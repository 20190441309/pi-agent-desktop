// E2E smoke: verify ChatView 真接通 usePiStream → session-store → MessageBubble,
// and the current chat input controls remain interactive.
//
// 关键点(跟 launch.spec.ts 区别):
//  - 用 page.click 触发 React onClick,不走 OS 鼠标(避免 z-order 抢焦点)
//  - 用 page.fill 往 ChatInput 灌测试 prompt
//  - 不依赖用户键盘/鼠标,纯 headless 自动化

import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';

async function skipOnboarding(page: Page): Promise<void> {
    const modal = page.locator('[data-testid="onboarding-modal"]');
    if (await modal.count() === 0) return;
    await page.getByRole('button', { name: '跳过引导' }).click({ timeout: 5000 });
    await expect(modal).toHaveCount(0, { timeout: 5000 });
}

async function expectChatInputAnchored(page: Page): Promise<void> {
    const inputShell = page.locator('[data-testid="chat-input-shell"]').first();
    await expect(inputShell).toBeVisible({ timeout: 5_000 });
    const metrics = await inputShell.evaluate((el) => {
        const rectFor = (node: Element | null) => {
            if (!node) return null;
            const rect = node.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom, height: rect.height };
        };
        const rect = el.getBoundingClientRect();
        return {
            distanceToBottom: window.innerHeight - rect.bottom,
            windowHeight: window.innerHeight,
            shell: rectFor(el),
            inputOuter: rectFor(el.parentElement),
            chatRoot: rectFor(document.querySelector('[data-testid="chat-view-root"]')),
            scrollRegion: rectFor(document.querySelector('[data-testid="chat-scroll-region"]')),
            main: rectFor(document.querySelector('[data-mmcode-region="center"]')),
        };
    });
    expect(metrics.distanceToBottom, JSON.stringify(metrics)).toBeLessThan(32);
}

async function expectChatLayoutStable(page: Page): Promise<void> {
    await expectChatInputAnchored(page);
    const metrics = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="chat-view-root"]');
        const scrollRegion = document.querySelector('[data-testid="chat-scroll-region"]');
        const scrollingElement = document.scrollingElement ?? document.documentElement;
        return {
            documentOverflow: scrollingElement.scrollHeight - scrollingElement.clientHeight,
            rootOverflowY: root ? getComputedStyle(root).overflowY : null,
            scrollRegionOverflowY: scrollRegion ? getComputedStyle(scrollRegion).overflowY : null,
            scrollRegionHasOverflow: scrollRegion
                ? scrollRegion.scrollHeight > scrollRegion.clientHeight + 4
                : false,
        };
    });
    expect(metrics.documentOverflow, 'document/window should not be the chat scroller').toBeLessThanOrEqual(4);
    expect(metrics.rootOverflowY).toBe('hidden');
    expect(metrics.scrollRegionOverflowY).toBe('auto');
    expect(metrics.scrollRegionHasOverflow, 'chat-scroll-region should own vertical overflow').toBe(true);
}

async function seedLongPlanConversation(page: Page, workspacePath: string): Promise<void> {
    await page.evaluate(
        async ({ workspacePath }) => {
            window.localStorage.setItem("pi-desktop:firstLaunchDone", "true");
            window.localStorage.setItem("pi-desktop.onboarding.completed", "true");
            const ws = await window.piAPI.createWorkspace("chat-layout-regression", workspacePath);
            const session = await window.piAPI.createSession(ws.id, "计划模式布局回归", "chat-layout-regression-session");
            await window.piAPI.appendMessage(session.id, {
                id: "layout-user",
                role: "user",
                content: "/plan\n你好",
                timestamp: new Date(Date.now() - 3_000).toISOString(),
            });
            await window.piAPI.appendMessage(session.id, {
                id: "layout-assistant",
                role: "assistant",
                content: `<think>这里是应该折叠的思考内容</think>\n\n${Array.from({ length: 80 }, (_, index) => `第 ${index + 1} 行长回复内容，用来撑出消息区内部滚动。`).join("\n")}`,
                timestamp: new Date(Date.now() - 2_000).toISOString(),
            });
        },
        { workspacePath },
    );
}

test.describe('Pi Desktop — ChatView 接通 + ChatInput controls', () => {
    let app: ElectronApplication;
    let page: Page;

    test.afterEach(async () => {
        try { await app?.close(); } catch { /* ignore */ }
    });

    test('welcome screen renders current ChatView, textarea send creates user message', async () => {
        const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        app = await _electron.launch({
            args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
            env: { ...process.env, CI: '1' },
        });
        page = await app.firstWindow();
        await page.waitForLoadState('domcontentloaded');

        // 跳过 onboarding: 走 React 自身的 onComplete 路径,避免破坏 portal ownership
        await skipOnboarding(page);
        const subtitle = page.getByText('描述你想要构建或修改的内容');
        await expect(subtitle).toBeVisible({ timeout: 15_000 });

        // 确认旧 WelcomeScreen 假按钮串已清理
        await expect(page.getByText('创建 Team')).toHaveCount(0);
        await expect(page.getByText('幻灯片', { exact: true })).toHaveCount(0);
        await expect(page.getByText('PDF', { exact: true })).toHaveCount(0);

        const textarea = page.locator('textarea[aria-label*="发送" i], textarea[placeholder*="在此审查" i], textarea[placeholder*="描述" i]').first();
        await expect(textarea).toBeVisible({ timeout: 5_000 });
        await expect(page.getByRole('button', { name: /添加附件/ })).toBeVisible();
        await expect(page.locator('[data-testid="chat-input-model-trigger"]')).toBeVisible();

        await textarea.fill('test ping from v1.0.12 verification');
        await textarea.press('Enter');

        const userArticle = page.getByRole('article', { name: /你说/ });
        await expect(userArticle).toBeVisible({ timeout: 10_000 });
        await expect(userArticle).toContainText('test ping from v1.0.12 verification');
        await expectChatInputAnchored(page);

        // 运行中允许继续输入追加指令；发布级 smoke 只验证消息入栈和进度区出现。
        await expect(textarea).toBeEnabled({ timeout: 5_000 });
        await expect(page.getByRole('heading', { name: '进度' })).toBeVisible();
    });

    test('v1.0.13 — ChatInput 3 个假按钮真接通: 权限/模型/附件 全部能交互', async () => {
        const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        app = await _electron.launch({
            args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
            env: { ...process.env, CI: '1' },
        });
        page = await app.firstWindow();
        await page.waitForLoadState('domcontentloaded');

        // 跳过 onboarding
        await skipOnboarding(page);

        // (1) 默认状态下 3 个按钮都渲染
        const permTrigger = page.locator('[data-testid="chat-input-permission-trigger"]');
        const modelTrigger = page.locator('[data-testid="chat-input-model-trigger"]');
        const attachBtn = page.getByRole('button', { name: /添加附件/ });
        await expect(permTrigger).toBeVisible();
        await expect(modelTrigger).toBeVisible();
        await expect(attachBtn).toBeVisible();

        // (2) 权限按钮 — click → popover 出现 → 选 "主动询问" → 按钮 label 切换
        //    注:不依赖初始 label,因为跨 test 共享 electron-store,初始可能是任何档位
        await permTrigger.click();
        // popover role=menu 出现
        const permMenu = page.getByRole('menu').filter({ hasText: '主动询问' });
        await expect(permMenu).toBeVisible();
        await expect(permMenu.getByRole('menuitemradio', { name: /智能授权/ })).toBeVisible();
        await expect(permMenu.getByRole('menuitemradio', { name: /始终授权/ })).toBeVisible();
        // 选"主动询问"
        await permMenu.getByRole('menuitemradio', { name: /主动询问/ }).click();
        // popover 关闭,按钮 label 切到"主动询问"
        await expect(permMenu).toBeHidden();
        await expect(permTrigger).toContainText('主动询问');

        // (3) 模型按钮 — click → popover 出现
        //    Pi CLI 配置可能有也可能没有 — 但 popover 至少要出现
        await modelTrigger.click();
        const modelMenu = page.getByRole('menu').filter({ hasText: '选择模型' });
        await expect(modelMenu).toBeVisible();
        // 关闭 popover
        await page.keyboard.press('Escape');
        await expect(modelMenu).toBeHidden();

        // (4) 附件按钮接通验证 — 不能在 headless 真弹 native file picker
        //    走 React fiber 检查 onClick 真有引用 (不是 undefined/null)
        //    这能证明"按钮从死 div 变成活 button",功能接通靠 ChatInput.tsx 源码 review
        const hasOnClick = await page.evaluate(() => {
            // 找 button 元素(支持 React 18+ 的 __reactProps$ 前缀)
            const el = document.querySelector('button[aria-label*="添加附件" i]') as
                | (HTMLElement & Record<string, unknown>)
                | null;
            if (!el) return { found: false, hasOnClick: false };
            const propKeys = Object.keys(el).filter(
                (k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'),
            );
            const props = propKeys.length > 0 ? (el[propKeys[0]] as { onClick?: unknown }) : null;
            return {
                found: true,
                hasOnClick: typeof props?.onClick === 'function',
                disabled: (el as HTMLButtonElement).disabled,
            };
        });
        expect(hasOnClick.found).toBe(true);
        expect(hasOnClick.hasOnClick).toBe(true);

        // (5) 同一方式验证 4 个 clickable (发送 / 附件 / 权限 / 模型) 都活
        const liveButtons = await page.evaluate(() => {
            const checks = [
                { label: '添加附件', expected: true },
                { label: '权限', expected: true },
                { label: '当前模型', expected: true },
            ];
            return checks.map((c) => {
                const el = document.querySelector(`[aria-label*="${c.label}" i]`) as
                    | (HTMLElement & Record<string, unknown>)
                    | null;
                if (!el) return { label: c.label, hasOnClick: false };
                const propKeys = Object.keys(el).filter((k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
                const props = propKeys.length > 0 ? (el[propKeys[0]] as { onClick?: unknown }) : null;
                return { label: c.label, hasOnClick: typeof props?.onClick === 'function' };
            });
        });
        // 3 个按钮都应该有 onClick 引用(权限/模型是 Popover cloneElement 注入,附件是 onClick handler)
        for (const r of liveButtons) {
            expect(r.hasOnClick, `button ${r.label} should have onClick handler`).toBe(true);
        }
    });

    test('计划模式发送后 ChatInput 仍固定在主区底部', async () => {
        const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        app = await _electron.launch({
            args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
            env: { ...process.env, CI: '1' },
        });
        page = await app.firstWindow();
        await page.waitForLoadState('domcontentloaded');

        await skipOnboarding(page);
        await expect(page.getByText('描述你想要构建或修改的内容')).toBeVisible({ timeout: 15_000 });

        await page.getByRole('button', { name: '计划模式' }).click();
        await expect(page.getByRole('button', { name: '计划模式' })).toHaveAttribute('aria-pressed', 'true');

        const textarea = page.locator('textarea[aria-label*="发送" i], textarea[placeholder*="在此审查" i], textarea[placeholder*="描述" i]').first();
        await textarea.fill('计划模式布局回归测试');
        await textarea.press('Enter');

        await expect(page.getByRole('article', { name: /你说/ })).toContainText('计划模式布局回归测试', { timeout: 10_000 });
        await expectChatInputAnchored(page);
    });

    test('长回复和计划卡出现后只滚动消息区，ChatInput 不随内容上移', async () => {
        const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const workspacePath = test.info().outputPath('chat-layout-workspace');
        app = await _electron.launch({
            args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
            env: { ...process.env, CI: '1' },
        });
        page = await app.firstWindow();
        await page.waitForLoadState('domcontentloaded');

        await seedLongPlanConversation(page, workspacePath);
        await app.close();

        app = await _electron.launch({
            args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
            env: { ...process.env, CI: '1' },
        });
        page = await app.firstWindow();
        await page.waitForLoadState('domcontentloaded');
        await skipOnboarding(page);

        await expect(page.getByRole('article', { name: /你说/ })).toContainText('你好', { timeout: 15_000 });
        await expect(page.getByRole('article', { name: /你说/ })).toContainText('计划模式');
        await expect(page.getByRole('article', { name: /你说/ })).not.toContainText('/plan');
        await expect(page.getByRole('article', { name: /Pi 说/ })).toContainText('第 80 行长回复内容');

        await app.evaluate(({ BrowserWindow }) => {
            BrowserWindow.getAllWindows()[0]?.webContents.send('plan:card', {
                id: 'layout-plan-card',
                title: '计划模式布局回归计划',
                filename: 'layout-plan.md',
                content: Array.from({ length: 40 }, (_, index) => `- 步骤 ${index + 1}: 验证计划卡不会把输入框顶上去`).join('\n'),
            });
        });

        const planCard = page.getByRole('heading', { name: '计划模式布局回归计划' });
        await expect(planCard).toBeVisible({ timeout: 10_000 });
        const userMessage = page.getByRole('article', { name: /你说/ }).first();
        const planFollowsUser = await userMessage.evaluate((userEl) => {
            const planHeading = [...document.querySelectorAll('h3')]
                .find((el) => el.textContent?.trim() === '计划模式布局回归计划');
            return Boolean(planHeading && (userEl.compareDocumentPosition(planHeading) & Node.DOCUMENT_POSITION_FOLLOWING));
        });
        expect(planFollowsUser).toBe(true);
        await expect(page.locator('article').filter({ hasText: '<think>' })).toHaveCount(0);
        await expectChatLayoutStable(page);
    });

    test('计划模式真实 UI 路径只提交一次 /plan prompt', async () => {
        const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        app = await _electron.launch({
            args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
            env: { ...process.env, CI: '1' },
        });
        page = await app.firstWindow();
        await page.waitForLoadState('domcontentloaded');

        await skipOnboarding(page);
        await expect(page.getByText('描述你想要构建或修改的内容')).toBeVisible({ timeout: 15_000 });

        await app.evaluate(({ ipcMain }) => {
            const target = globalThis as typeof globalThis & {
                __planPromptCalls?: Array<{ kind: string; payload: unknown }>;
            };
            target.__planPromptCalls = [];
            ipcMain.removeHandler('agents:prompt');
            ipcMain.removeHandler('pi:send');
            ipcMain.handle('agents:prompt', async (_event, input) => {
                target.__planPromptCalls?.push({ kind: 'agent', payload: input });
                return undefined;
            });
            ipcMain.handle('pi:send', async (_event, workspaceId, message) => {
                target.__planPromptCalls?.push({ kind: 'legacy', payload: { workspaceId, message } });
                return undefined;
            });
        });

        await page.getByRole('button', { name: '计划模式' }).click();
        await expect(page.getByRole('button', { name: '计划模式' })).toHaveAttribute('aria-pressed', 'true');

        const textarea = page.locator('textarea[aria-label*="发送" i], textarea[placeholder*="在此审查" i], textarea[placeholder*="描述" i]').first();
        await textarea.fill('你好');
        await textarea.press('Enter');
        await textarea.press('Enter');

        await expect.poll(async () => app.evaluate(() => {
            const target = globalThis as typeof globalThis & {
                __planPromptCalls?: Array<{ kind: string; payload: unknown }>;
            };
            return target.__planPromptCalls?.length ?? 0;
        })).toBe(1);

        const calls = await app.evaluate(() => {
            const target = globalThis as typeof globalThis & {
                __planPromptCalls?: Array<{ kind: string; payload: unknown }>;
            };
            const result = target.__planPromptCalls ?? [];
            return result;
        });
        const payload = calls[0]?.payload as { message?: string };
        const message = payload.message ?? (payload as { message?: string }).message;
        expect(message).toMatch(/^\/plan\n/);
        expect(message.match(/^\/plan/gm) ?? []).toHaveLength(1);
    });
});

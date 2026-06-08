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

        // Pi 正在 streaming 回复 — ChatInput 因 isProcessing 锁住(稳证据)
        await expect(textarea).toBeDisabled({ timeout: 5_000 });

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
});

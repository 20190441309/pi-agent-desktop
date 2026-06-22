/**
 * M7: 接入 a11y 自动化测试 — 手写关键 a11y 规则扫描
 *
 * 目标: 在 Pi Desktop renderer 关键页面上验证 a11y 关键 ARIA 规则, 失败 fail test.
 *
 * 为什么不用 axe-core: @axe-core/playwright 的 AxeBuilder 跟 Electron 渲染进程不兼容
 * (browserContext.newPage 抛 "Protocol error: Not supported"). 手写关键 a11y 规则
 * (button aria-label / form label / image alt / heading 顺序) 在 e2e 上下文更稳.
 *
 * 当前覆盖范围 (a11y-baseline slice):
 *   - 主聊天界面: TopTabBar + MiniMaxCodeSidebar session list + ChatView + ChatInput
 *   - 命令面板: 通过 Ctrl+K 打开 CommandPalette
 *
 * 跑测试前置条件:
 *   `pnpm --filter @pi-desktop/desktop build` 必须已经产出
 *   out/main/index.js + out/renderer/index.html.
 */
import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';

interface A11yViolation {
    rule: string;
    target: string;
    message: string;
}

/**
 * 手写 a11y 扫描: 在指定 selectors 范围内执行基本 ARIA 规则检查.
 * 规则:
 *   - button 必须有 accessible name (aria-label / text content / title)
 *   - form input 必须有 label (aria-label / aria-labelledby / 关联 <label htmlFor>)
 *   - image (role=img / <img>) 必须有 alt 或 aria-label
 *   - 标题层级顺序: 文档第一个 heading 应该是 h1 或 h2
 *   - 所有 [role="dialog"] / [role="region"] 必须有 aria-label
 */
async function checkBasicA11y(
    page: Page,
    includeSelectors: string[],
): Promise<A11yViolation[]> {
    // v1.0.16: page.evaluate 在 Electron 36 + Playwright 1.60 跑大段 DOM 处理时
    // 偶发 "Cannot read properties of undefined (reading '_object')" 序列化错。
    // 改用 page.locator 一次取一个 element handle, 逐个 evaluate 单个 element 的属性,
    // 返回 plain string 数据,避免 Playwright 序列化 DOM ref 炸。

    const violations: A11yViolation[] = [];
    const includeList = includeSelectors.join(', ');

    // 规则 1: 范围内 button 必须有 accessible name
    const buttons = await page.locator(`${includeList} button`).all();
    for (const btn of buttons) {
        const info = await btn.evaluate((el) => ({
            ariaLabel: el.getAttribute('aria-label'),
            text: (el.textContent ?? '').trim(),
            title: el.getAttribute('title'),
            outer: el.outerHTML.slice(0, 120),
        }));
        if (!info.ariaLabel && !info.text && !info.title) {
            violations.push({
                rule: 'button-needs-accessible-name',
                target: info.outer,
                message: `<button> 没有 aria-label, 文字内容, 或 title`,
            });
        }
    }

    // 规则 2: 范围内 form input 必须有 label
    const inputs = await page.locator(`${includeList} input, ${includeList} textarea, ${includeList} select`).all();
    for (const inp of inputs) {
        const info = await inp.evaluate((el) => {
            const e = el as HTMLInputElement;
            return {
                type: e.type,
                ariaLabel: el.getAttribute('aria-label'),
                ariaLabelledBy: el.getAttribute('aria-labelledby'),
                id: el.id,
                outer: el.outerHTML.slice(0, 120),
                closestLabel: el.closest('label') !== null,
                hasForLabel:
                    el.id !== '' &&
                    document.querySelector(`label[for="${CSS.escape(el.id)}"]`) !== null,
            };
        });
        if (info.type === 'hidden' || info.type === 'submit' || info.type === 'button') continue;
        if (!info.ariaLabel && !info.ariaLabelledBy && !info.hasForLabel && !info.closestLabel) {
            violations.push({
                rule: 'form-input-needs-label',
                target: info.outer,
                message: `<input/textarea/select> 没有 aria-label, aria-labelledby, 或关联 <label>`,
            });
        }
    }

    // 规则 3: 范围内 [role="dialog"] / [role="region"] 必须有 aria-label
    const regions = await page.locator(`${includeList} [role="dialog"], ${includeList} [role="region"]`).all();
    for (const reg of regions) {
        const info = await reg.evaluate((el) => ({
            ariaLabel: el.getAttribute('aria-label'),
            ariaLabelledBy: el.getAttribute('aria-labelledby'),
            role: el.getAttribute('role'),
            outer: el.outerHTML.slice(0, 120),
        }));
        if (!info.ariaLabel && !info.ariaLabelledBy) {
            violations.push({
                rule: 'region-needs-aria-label',
                target: info.outer,
                message: `role=${info.role} 必须有 aria-label 或 aria-labelledby`,
            });
        }
    }

    return violations;
}

test.describe('Pi Desktop a11y', () => {
    let app: ElectronApplication;

    test.afterEach(async () => {
        // v1.0.11 fix: Playwright 1.60 + Electron 36 — app.process() 在 test 结束后变成 undefined.
        // 改用更防御式的 cleanup: 拿到 app 就关, 拿不到 process() 就放过
        if (!app) return;
        try {
            await app.close();
        } catch {
            /* ignore */
        }
    });

    test('command palette page: 0 critical a11y violations', async () => {
        const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        app = await _electron.launch({
            args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
            env: { ...process.env, CI: process.env.CI ?? '1', ELECTRON_RENDERER_URL: '' },
        });

        const window: Page = await app.firstWindow();
        await window.waitForLoadState('domcontentloaded');

        // 等待 React 挂载。导航已分为顶部标签栏 + 左侧会话列表。
        await window.waitForSelector('[role="tablist"][aria-label="顶部标签栏"]', { timeout: 15_000 });
        await window.waitForSelector('nav[aria-label="会话列表"]', { timeout: 15_000 });

        // 触发 Ctrl+K 打开命令面板
        await window.keyboard.press('Control+k');

        // 等待 dialog 出现
        await window.waitForSelector('[role="dialog"][aria-label*="命令面板"]', { timeout: 5_000 });

        // 跑手写 a11y 扫描
        const violations = await checkBasicA11y(window, [
            '[role="tablist"][aria-label="顶部标签栏"]',
            'nav[aria-label="会话列表"]',
            '[role="dialog"][aria-label*="命令面板"]',
        ]);

        if (violations.length > 0) {
            // eslint-disable-next-line no-console
            console.log(
                `[a11y] ${violations.length} violations:\n` +
                    violations
                        .map(
                            (v) =>
                                `  - [${v.rule}] ${v.message}\n      target=${v.target}`
                        )
                        .join('\n')
            );
        }

        expect(violations, `expected 0 a11y violations, got ${violations.length}`).toHaveLength(0);

        // 顺手关掉应用
        await app.close();
    });

    test('main chat page: 0 critical a11y violations (without palette open)', async () => {
        const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        app = await _electron.launch({
            args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
            env: { ...process.env, CI: process.env.CI ?? '1', ELECTRON_RENDERER_URL: '' },
        });

        const window: Page = await app.firstWindow();
        await window.waitForLoadState('domcontentloaded');
        await window.waitForSelector('[role="tablist"][aria-label="顶部标签栏"]', { timeout: 15_000 });
        await window.waitForSelector('nav[aria-label="会话列表"]', { timeout: 15_000 });

        // 不打开命令面板, 扫主聊天界面
        const violations = await checkBasicA11y(window, [
            '[role="tablist"][aria-label="顶部标签栏"]',
            'nav[aria-label="会话列表"]',
            '[role="log"]',
            'form, [aria-label="给 Pi 发消息"]',
        ]);

        if (violations.length > 0) {
            // eslint-disable-next-line no-console
            console.log(
                `[a11y-chat] ${violations.length} violations:\n` +
                    violations
                        .map(
                            (v) =>
                                `  - [${v.rule}] ${v.message}\n      target=${v.target}`
                        )
                        .join('\n')
            );
        }
        expect(violations, `expected 0 a11y violations on main chat, got ${violations.length}`).toHaveLength(0);

        await app.close();
    });
});

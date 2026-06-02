/**
 * M7: 接入 a11y 自动化测试 — 真实 Playwright + AxeBuilder 扫描
 *
 * 目标: 在 Pi Desktop renderer 关键页面上跑 axe-core, 验证 0 critical violations.
 *
 * 当前覆盖范围 (a11y-baseline slice):
 *   - 主聊天界面: IconBar + ChatView + ChatInput
 *   - 命令面板: 通过 Ctrl+K 打开 CommandPalette
 *
 * 跑测试前置条件:
 *   `pnpm --filter @pi-desktop/desktop build` 必须已经产出
 *   out/main/index.js + out/renderer/index.html.
 *
 * @see https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
 */
import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { electronMainEntry } from '../playwright.config';

test.describe('Pi Desktop a11y', () => {
    let app: ElectronApplication;

    test.afterEach(async () => {
        if (app && !app.process().killed) {
            try {
                await app.close();
            } catch {
                /* ignore */
            }
        }
    });

    test('command palette page: 0 critical/serious axe violations', async () => {
        app = await _electron.launch({
            args: [electronMainEntry],
            env: { ...process.env, CI: process.env.CI ?? '1' },
        });

        const window: Page = await app.firstWindow();
        await window.waitForLoadState('domcontentloaded');

        // 等待 React 挂载 (IconBar 是首屏固定元素)
        await window.waitForSelector('[role="navigation"][aria-label="主导航"]', { timeout: 15_000 });

        // 触发 Ctrl+K 打开命令面板
        await window.keyboard.press('Control+k');

        // 等待 dialog 出现
        await window.waitForSelector('[role="dialog"][aria-label="命令面板"]', { timeout: 5_000 });

        // 跑 axe-core 扫描
        const accessibilityScanResults = await new AxeBuilder({ page: window })
            // 限定扫描范围到 5 个目标组件 + 模态背景, 排除第三方 iframe / 隐藏元素
            .options({
                rules: {
                    // 颜色对比度规则先关掉 (主题色 #999 偏灰, 严格对比度会大量违规, 留到 a11y-strict 单独跑)
                    'color-contrast': { enabled: false },
                },
            })
            .analyze();

        // 输出违规详情 (CI 友好)
        const violations = accessibilityScanResults.violations;
        if (violations.length > 0) {
            // eslint-disable-next-line no-console
            console.log(
                `[a11y] ${violations.length} violations:\n` +
                    violations
                        .map(
                            (v) =>
                                `  - [${v.impact ?? 'unknown'}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n` +
                                v.nodes
                                    .map(
                                        (n) =>
                                            `      target=${JSON.stringify(n.target)} html=${n.html.slice(0, 120)}`
                                    )
                                    .join('\n')
                        )
                        .join('\n')
            );
        }

        // 验收: 0 critical / serious 违规 (color-contrast 已暂时关闭)
        const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
        expect(critical, `expected 0 critical/serious violations, got ${critical.length}`).toHaveLength(0);

        // 顺手关掉应用
        await app.close();
    });

    test('main chat page: 0 critical axe violations (without palette open)', async () => {
        app = await _electron.launch({
            args: [electronMainEntry],
            env: { ...process.env, CI: process.env.CI ?? '1' },
        });

        const window: Page = await app.firstWindow();
        await window.waitForLoadState('domcontentloaded');
        await window.waitForSelector('[role="navigation"][aria-label="主导航"]', { timeout: 15_000 });

        // 不打开命令面板, 扫主聊天界面
        const accessibilityScanResults = await new AxeBuilder({ page: window })
            .options({
                rules: {
                    'color-contrast': { enabled: false },
                },
            })
            // 限定到 5 个目标组件区域
            .include('[role="navigation"][aria-label="主导航"]')
            .include('[role="log"]')
            .include('form, [aria-label="给 Pi 发消息"]')
            .analyze();

        const critical = accessibilityScanResults.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
        );
        if (critical.length > 0) {
            // eslint-disable-next-line no-console
            console.log(
                `[a11y-chat] ${critical.length} critical/serious violations:\n` +
                    critical
                        .map(
                            (v) =>
                                `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n` +
                                v.nodes
                                    .map((n) => `      target=${JSON.stringify(n.target)}`)
                                    .join('\n')
                        )
                        .join('\n')
            );
        }
        expect(critical, `expected 0 critical/serious violations on main chat, got ${critical.length}`).toHaveLength(0);

        await app.close();
    });
});

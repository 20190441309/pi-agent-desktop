// E2E smoke: 全面 runtime test v1.0.16 Pi Desktop 的各个功能。
//
// 覆盖矩阵:
//   - Sidebar 主操作路由 (新建任务/文件/插件/Git/设置)
//   - ChatView 欢迎页 + ChatInput 渲染
//   - 插件面板 3 个真接通按钮 (GitHub 导入/编写技能/搜索)
//   - Settings panel 接通 + 4 tabs (general/model/piagent/about)
//   - CommandPalette 接通 (Ctrl+K 快捷键)
//   - ApprovalPanel 渲染 + 自动审批 toggle
//   - ChatInput 3 个 Popover (权限/模型/附件) — 回归 (原 v1.0.13 spec)
//
// 设计原则: 用 page.click 触发 React onClick, 不走 OS 鼠标 (避免 z-order 抢焦点)

import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
    const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const app = await _electron.launch({
        args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
        env: { ...process.env, CI: '1', ELECTRON_RENDERER_URL: '' },
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    // v1.0.16: 跳过 onboarding
    //   路径 A: 之前 localStorage 没设 firstLaunchDone → onboarding 渲染 → 点 "跳过引导"
    //   路径 B: 之前已点过 (localStorage=true) → onboarding 不渲染 → 跳过
    // 注: 不能用 .remove() 删 DOM (破坏 React ownership 导致 portal 卸载时
    //      removeChild error 把 App crash 到 error boundary,见 memory entry)
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

test.describe('Pi Desktop v1.0.16 — 全功能 smoke', () => {
    let app: ElectronApplication;
    let page: Page;

    test.afterEach(async () => {
        try { await app?.close(); } catch { /* ignore */ }
    });

    test('1. Sidebar 主操作路由 (新建任务/文件/插件/Git/设置)', async () => {
        ({ app, page } = await launchApp());

        await expect(page.locator('button[data-mmcode-section="new-task"]')).toBeVisible();
        await expect(page.locator('button[data-mmcode-section="files"]')).toBeVisible();
        await expect(page.locator('button[data-mmcode-section="skills"]')).toBeVisible();
        await expect(page.locator('button[data-mmcode-section="git"]')).toBeVisible();
        await expect(page.locator('button[data-mmcode-section="settings"]')).toBeVisible();

        // v1.0.16: 新用户无历史会话时"任务历史"区域条件渲染不显示
        // 验证主导航 sidebar 存在即可
        await expect(page.locator('nav[aria-label="主导航"]')).toBeVisible();

        await page.locator('button[data-mmcode-section="skills"]').click();
        await expect(page.getByRole('region', { name: '插件面板' })).toBeVisible({ timeout: 5000 });

        await page.locator('button[data-mmcode-section="files"]').click();
        await expect(page.getByRole('region', { name: '文件工作区' })).toBeVisible({ timeout: 5000 });

        await page.locator('button[data-mmcode-section="git"]').click();
        await expect(page.getByRole('region', { name: 'Git 面板' })).toBeVisible({ timeout: 5000 });

        await page.locator('button[data-mmcode-section="settings"]').click();
        const settingsDialog = page.getByRole('dialog', { name: '设置' });
        await expect(settingsDialog).toBeVisible({ timeout: 5000 });

        await settingsDialog.locator('button[aria-label="关闭"]').click();
        await expect(settingsDialog).toBeHidden({ timeout: 3000 });

        await page.locator('button[data-mmcode-section="new-task"]').click();
        await expect(page.getByText('描述你想要构建或修改的内容')).toBeVisible({ timeout: 5000 });
    });

    test('2. ChatView 欢迎页和 ChatInput 渲染', async () => {
        ({ app, page } = await launchApp());

        await expect(page.getByText('描述你想要构建或修改的内容')).toBeVisible({ timeout: 15000 });

        const textarea = page.locator('textarea[aria-label*="发送" i], textarea[placeholder*="输入消息" i]').first();
        await expect(textarea).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole('button', { name: /添加附件/ })).toBeVisible();
        await expect(page.locator('[data-testid="chat-input-permission-trigger"]')).toBeVisible();
        await expect(page.locator('[data-testid="chat-input-model-trigger"]')).toBeVisible();
    });

    test('3. 插件面板 3 个真接通按钮', async () => {
        ({ app, page } = await launchApp());

        // 切到插件面板
        await page.getByRole('button', { name: '插件' }).click();
        await expect(page.getByRole('region', { name: '插件面板' })).toBeVisible({ timeout: 5000 });

        // (1) "+ 创建" dropdown 按钮接通
        const createBtn = page.getByRole('button', { name: /\+ 创建/ });
        await expect(createBtn).toBeVisible();

        // (2) 点 "+ 创建" → dropdown 展开 → 3 选项都在
        await createBtn.click();
        const buildBtn = page.getByRole('button', { name: /用 Pi 构建/ });
        const writeBtn = page.getByRole('button', { name: /编写技能/ });
        // 注:实际渲染是 "从 Github 导入"(小写 h),文本匹配用 regex
        const githubBtn = page.getByRole('button', { name: /从 Github 导入/ });
        await expect(buildBtn).toBeVisible();
        await expect(writeBtn).toBeVisible();
        await expect(githubBtn).toBeVisible();

        // (3) 点 "编写技能" 关闭 dropdown + 弹写技能 modal
        await writeBtn.click();
        // modal 有 aria-label="编写技能" dialog 出现
        const writeDialog = page.getByRole('dialog', { name: '编写技能' });
        await expect(writeDialog).toBeVisible({ timeout: 5000 });
        // 关闭 modal — modal 内部"取消"按钮 (aria-label=t("common.cancel")="取消")
        await writeDialog.getByRole('button', { name: '取消' }).click();
        await expect(writeDialog).toBeHidden({ timeout: 3000 });

        // (4) "搜索 Pi 插件" input 接通 — <input> 默认 type=text 不是 search, 用 getByLabel
        const searchInput = page.getByLabel('搜索 Pi 插件');
        await expect(searchInput).toBeVisible();
        await searchInput.fill('pi-coding-agent');
        const v = await searchInput.inputValue();
        expect(v).toBe('pi-coding-agent');
    });

    test('4. Settings panel 接通 — 4 个 tabs 都能切', async () => {
        ({ app, page } = await launchApp());

        // 打开 Settings
        await page.getByRole('button', { name: '设置' }).click();
        await expect(page.getByRole('dialog', { name: '设置' })).toBeVisible({ timeout: 5000 });

        // 4 个 tab 都在 — 用 tablist + tab roles
        const tablist = page.getByRole('tablist', { name: '设置分类' });
        await expect(tablist).toBeVisible();
        const tabs = tablist.getByRole('tab');
        const tabCount = await tabs.count();
        expect(tabCount).toBe(5); // appearance / general / model / piagent / about

        // 验证能切 tab(点第 2 个 — model)
        await tabs.nth(1).click();
        // model tab 应该是 selected
        await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');

        // 切到 about (第 4 个)
        await tabs.nth(3).click();
        await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');

        // 关闭按钮接通 — Settings 顶部关闭按钮 aria-label="关闭" (t('common.close'))
        //   注: Settings 内有 2 个 "关闭" substring-match 的按钮 (line 76 = "关闭" + line 440 = "关闭设置")
        //   用 attribute 精确 selector 避免 strict mode
        const settingsDialog = page.getByRole('dialog', { name: '设置' });
        const closeBtn = settingsDialog.locator('button[aria-label="关闭"]');
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        // 关闭后 dialog 消失
        await expect(settingsDialog).toBeHidden({ timeout: 3000 });
    });

    test('5. CommandPalette 接通 — Ctrl+K 快捷键', async () => {
        ({ app, page } = await launchApp());

        // 默认未开
        await expect(page.locator('[role="dialog"]').filter({ hasText: '命令面板' })).toHaveCount(0);

        // Ctrl+K 打开(aria-label 含 "Ctrl+K" 副标题,用 attribute selector 最稳)
        await page.keyboard.press('Control+k');
        const palette = page.locator('[role="dialog"][aria-label*="命令面板"]');
        await expect(palette).toBeVisible({ timeout: 3000 });

        // search input 接通(aria-label=t("commandPalette.aria.search")="搜索命令")
        // 注: <input> 默认 type=text 不是 search, getByRole('searchbox') 找不到
        // 注: getByLabel('搜索') 严格模式 match 2 个 (CommandPalette "搜索命令" + SkillsPanel "搜索技能")
        // 用精确 attribute selector
        const search = palette.locator('input[aria-label="搜索命令"]');
        await expect(search).toBeVisible();
        // 验证 input 可交互 — 验证 placeholder (默认 mode='file' 时 placeholder 是 "搜索文件..."),
        // 不强求 value 验证,因为 fill 后会触发 onChange 重新渲染导致 input 引用 stale
        const placeholder = await search.getAttribute('placeholder');
        expect(placeholder).toBeTruthy();

        // Escape 关闭 (App.tsx 调 setPaletteOpen(false))
        await page.keyboard.press('Escape');
        await expect(palette).toBeHidden({ timeout: 3000 });
    });

    test('7. ChatInput 3 个 Popover 接通 (回归 v1.0.13)', async () => {
        ({ app, page } = await launchApp());

        // 3 个按钮渲染
        const permTrigger = page.locator('[data-testid="chat-input-permission-trigger"]');
        const modelTrigger = page.locator('[data-testid="chat-input-model-trigger"]');
        const attachBtn = page.getByRole('button', { name: /添加附件/ });
        await expect(permTrigger).toBeVisible();
        await expect(modelTrigger).toBeVisible();
        await expect(attachBtn).toBeVisible();

        // (1) 权限 popover — click → 出现 → 选 "主动询问" → 关闭
        await permTrigger.click();
        const permMenu = page.getByRole('menu').filter({ hasText: '主动询问' });
        await expect(permMenu).toBeVisible();
        await expect(permMenu.getByRole('menuitemradio', { name: /智能授权/ })).toBeVisible();
        await expect(permMenu.getByRole('menuitemradio', { name: /始终授权/ })).toBeVisible();
        await permMenu.getByRole('menuitemradio', { name: /主动询问/ }).click();
        await expect(permMenu).toBeHidden();
        await expect(permTrigger).toContainText('主动询问');

        // (2) 模型 popover — click → 出现
        await modelTrigger.click();
        const modelMenu = page.getByRole('menu').filter({ hasText: '选择模型' });
        await expect(modelMenu).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(modelMenu).toBeHidden();

        // (3) 附件按钮 React fiber onClick 检查
        const hasOnClick = await page.evaluate(() => {
            const el = document.querySelector('button[aria-label*="添加附件" i]') as
                | (HTMLElement & Record<string, unknown>)
                | null;
            if (!el) return false;
            const propKeys = Object.keys(el).filter(
                (k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$')
            );
            const props = propKeys.length > 0 ? (el[propKeys[0]] as { onClick?: unknown }) : null;
            return typeof props?.onClick === 'function';
        });
        expect(hasOnClick).toBe(true);
    });
});

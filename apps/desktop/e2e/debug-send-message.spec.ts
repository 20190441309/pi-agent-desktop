// E2E 调试: 复现 user 报的 "发消息没回复" 场景
//
// 跑这个 spec 看:
//   1. 主进程 stderr 全部 (chat.ipc 行为 + pi-driver 行为)
//   2. renderer 收到的 pi:event (text_delta / agent_start / agent_end)
//   3. user message 之后 30s 内, 是否出现 assistant message
//   4. 主进程 log tail 内容 (electron-log)
//
// 已知: chat.test.ts 用 PI_TEST_API_KEY + createAgentSession(prompt) 跑, 需要 API key
// 才会触发 model call. 没 API key 时 prompt 不会 emit 任何 PiEvent (这是 v1.0.10 skipIf).
//
// 我们的场景: user 装了 Pi CLI, 用 longcat provider (LongCat-2.0-Preview).
//  spec 环境若没装 Pi / 没配 longcat, prompt 会 throw, 红条会出.

import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';

test.describe('Debug: 发消息回复', () => {
    let app: ElectronApplication;
    let page: Page;
    let mainLog = '';

    test('发消息 + 收主进程 stderr + 等 30s', async () => {
        // pipe main stderr/stdout
        app = await _electron.launch({
            args: [electronMainEntry],
            env: { ...process.env, CI: '1' },
        });
        app.process().stdout?.on('data', (d) => process.stdout.write(`[m] ${d}`));
        app.process().stderr?.on('data', (d) => {
            const s = d.toString();
            mainLog += s;
            process.stderr.write(`[m] ${s}`);
        });
        page = await app.firstWindow();
        await page.waitForLoadState('domcontentloaded');

        // 跳过 onboarding
        const modal = await page.locator('[data-testid="onboarding-modal"]').count();
        if (modal > 0) {
            await page.getByRole('button', { name: '跳过引导' }).click({ timeout: 5000 });
            await page.waitForFunction(
                () => document.querySelector('[data-testid="onboarding-modal"]') === null,
                { timeout: 5000 },
            );
        }

        // 验证 PiStatusPanel 出现 + Pi 装好
        const isInstalled = await page.evaluate(() =>
            document.body.innerText.includes('已安装') || document.body.innerText.includes('已装'),
        );
        console.log('[debug] PiStatusPanel shows installed:', isInstalled);

        // 找 textarea + fill + Enter
        const textarea = page.locator('textarea').first();
        await textarea.waitFor({ state: 'visible', timeout: 10_000 });
        await textarea.fill('hello from debug spec, reply with the single word pong');
        await textarea.press('Enter');
        console.log('[debug] user message sent, waiting 30s for assistant reply');

        // 等最多 30s, 看是否出现 "pong" 文本 (说明 Pi 真回复了)
        const replied = await page.locator('article, [role="article"]').filter({ hasText: /pong/i }).count();
        console.log('[debug] pong articles found:', replied);

        // 30s 等
        await page.waitForTimeout(30_000);
        const finalReply = await page.locator('article, [role="article"]').filter({ hasText: /pong/i }).count();
        console.log('[debug] after 30s, pong articles:', finalReply);

        // 抓 streamError (红条)
        const errorVisible = await page.locator('[role="alert"]').filter({ hasText: /失败|错误|error|fail/i }).count();
        console.log('[debug] error alerts visible:', errorVisible);

        // 取 streamError 文本
        const errorText = await page.locator('[role="alert"]').allTextContents();
        console.log('[debug] error alert texts:', errorText);

        // 取所有 article 文本 (看 assistant 真发了啥)
        const articleTexts = await page.locator('article, [role="article"]').allTextContents();
        console.log('[debug] all articles:', articleTexts);

        // 关 app
        await app.close();
    });

    test.afterEach(async () => {
        // 输出 main stderr 累积
        console.log('[debug] === main process stderr accumulated ===');
        console.log(mainLog);
        console.log('[debug] === end ===');
    });
});

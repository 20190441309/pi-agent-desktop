// v1.0.10 (manual smoke): 用 Playwright 的 _electron 直接启动, 看 firstWindow() 能不能拿到.
// 不用 axe-core / 不走 spec runner, 就 raw 验证 Electron 36 + 现有 bundle 跑得动.

const { _electron } = require('@playwright/test');

(async () => {
    const mainEntry = 'C:/Ai/pi-desktop/apps/desktop/out/main/index.js';
    console.log(`[manual] launching electron with: ${mainEntry}`);

    let app;
    try {
        app = await _electron.launch({ args: [mainEntry], env: { ...process.env, CI: '1' } });
        console.log('[manual] electron launched');

        const win = await app.firstWindow({ timeout: 30000 });
        console.log('[manual] firstWindow OK');

        // 等等渲染器挂载 + ready-to-show
        await win.waitForLoadState('domcontentloaded');
        console.log('[manual] DOMContentLoaded');

        // 给 React 一点时间 mount
        await new Promise((r) => setTimeout(r, 2000));

        const title = await win.title();
        console.log(`[manual] title = ${JSON.stringify(title)}`);

        const state = await app.evaluate(({ BrowserWindow }) => {
            const wins = BrowserWindow.getAllWindows();
            if (!wins.length) return { count: 0 };
            const w = wins[0];
            return {
                count: wins.length,
                visible: w.isVisible() && !w.isDestroyed(),
                title: w.getTitle(),
            };
        });
        console.log(`[manual] main window state = ${JSON.stringify(state)}`);

        // 看下渲染器 root 挂没
        const rootHasContent = await win.evaluate(() => {
            const r = document.getElementById('root');
            return !!r && r.children.length > 0;
        });
        console.log(`[manual] renderer root has content: ${rootHasContent}`);

        // 拍个截图
        try {
            await win.screenshot({ path: 'C:/Ai/pi-desktop/scripts/manual-launch-screenshot.png' });
            console.log('[manual] screenshot saved to scripts/manual-launch-screenshot.png');
        } catch (e) {
            console.log(`[manual] screenshot failed: ${e.message}`);
        }

        if (state.visible && rootHasContent) {
            console.log('[manual] ✅ 完整启动: 窗口可见 + React 挂载');
        } else if (state.visible) {
            console.log('[manual] ⚠️ 窗口可见但 React 未挂载');
        } else {
            console.log('[manual] ⚠️ 窗口创建但未 ready-to-show');
        }
    } catch (e) {
        console.error('[manual] ❌ FAILED:', e.message);
        if (e.stack) console.error(e.stack.split('\n').slice(0, 12).join('\n'));
        process.exitCode = 1;
    } finally {
        if (app) {
            try { await app.close(); } catch { /* ignore */ }
        }
    }
})();

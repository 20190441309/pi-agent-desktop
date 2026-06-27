import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import { electronMainEntry } from '../playwright.config';
import { resolveElectronExecutablePath } from "./support/electron-launch";

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const userDataDir = test.info().outputPath(`user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const app = await _electron.launch({
      executablePath: resolveElectronExecutablePath(),
    args: [`--user-data-dir=${userDataDir}`, electronMainEntry],
    env: { ...process.env, CI: '1', ELECTRON_RENDERER_URL: '' },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  const modal = page.locator('[data-testid="onboarding-modal"]');
  if (await modal.count()) {
    await page.getByRole('button', { name: '跳过引导' }).click();
    await expect(modal).toHaveCount(0, { timeout: 5_000 });
  }
  return { app, page };
}

async function setWindowSize(app: ElectronApplication, width: number, height: number): Promise<void> {
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setSize(size.width, size.height);
  }, { width, height });
}

test.describe('Pi Desktop layout panels', () => {
  let app: ElectronApplication;
  let page: Page;

  test.afterEach(async () => {
    try { await app?.close(); } catch { /* ignore */ }
  });

  test('left sidebar resizes and right rail floats only when workspace has room', async () => {
    ({ app, page } = await launchApp());
    await setWindowSize(app, 1365, 768);
    await page.bringToFront();

    await expect(page.getByText('输入消息后，Pi Agent 会在当前工作区开始运行。')).toBeVisible({ timeout: 15_000 });
    const rightPanel = page.locator('[data-mmcode-region="right-floating"]');
    await expect(rightPanel).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-mmcode-region="right"]')).toHaveCount(0);

    const resizeHandle = page.getByRole('separator', { name: '调整左侧栏宽度' });
    await expect(resizeHandle).toBeVisible();
    const before = await page.locator('[data-mmcode-region="left"]').evaluate((node) => node.getBoundingClientRect().width);
    const box = await resizeHandle.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + 82, box!.y + 40);
    await page.mouse.up();
    const after = await page.locator('[data-mmcode-region="left"]').evaluate((node) => node.getBoundingClientRect().width);
    const titleWidth = await page.locator('[data-mmcode-region="titlebar-left"]').evaluate((node) => node.getBoundingClientRect().width);
    expect(after).toBeGreaterThan(before + 40);
    expect(Math.abs(after - titleWidth)).toBeLessThan(2);

    const composer = page.locator('[data-testid="chat-input-shell"]');
    const composerResizeHandle = composer.getByRole('separator', { name: '调整输入框高度' });
    const composerBox = await composerResizeHandle.boundingBox();
    expect(composerBox).not.toBeNull();
    await page.mouse.move(composerBox!.x + composerBox!.width / 2, composerBox!.y + 3);
    await page.mouse.down();
    await page.mouse.move(composerBox!.x + composerBox!.width / 2, composerBox!.y - 96);
    await page.mouse.up();
    await expect.poll(async () => composer.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThan(180);
    const composerLayout = await composer.evaluate((node) => {
      const shell = node.getBoundingClientRect();
      const controls = node.querySelector('[data-testid="chat-input-reference-controls"]')?.getBoundingClientRect();
      const body = node.querySelector('[data-testid="chat-input-reference-body"]')?.getBoundingClientRect();
      return {
        shellHeight: shell.height,
        controlsGap: controls ? Math.abs(shell.bottom - controls.bottom) : 999,
        bodyHeight: body?.height ?? 0,
      };
    });
    expect(composerLayout.shellHeight).toBeGreaterThan(180);
    expect(composerLayout.bodyHeight).toBeGreaterThan(120);
    expect(composerLayout.controlsGap).toBeLessThan(4);
    const composerBounds = await composer.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left };
    });
    const centerBounds = await page.locator('[data-mmcode-region="center"]').evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left };
    });
    const leftBounds = await page.locator('[data-mmcode-region="left"]').evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { right: rect.right };
    });
    expect(composerBounds.left).toBeGreaterThanOrEqual(centerBounds.left - 1);
    expect(composerBounds.left).toBeGreaterThanOrEqual(leftBounds.right - 1);
    const rightRailOwnsOverlap = await rightPanel.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const target = document.elementFromPoint(rect.left + rect.width / 2, rect.bottom - 48);
      return Boolean(target?.closest('[data-mmcode-region="right-floating"]'));
    });
    expect(rightRailOwnsOverlap).toBe(true);
    await page.screenshot({ path: test.info().outputPath('composer-resized.png'), fullPage: true });

    await page.screenshot({ path: test.info().outputPath('layout-wide.png'), fullPage: true });

    await page.getByRole('button', { name: '折叠左侧栏' }).click();
    await expect(page.getByRole('button', { name: '展开左侧栏' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: '展开左侧栏' }).click();
    await expect(page.getByRole('button', { name: '折叠左侧栏' })).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: '收起右侧栏' }).click();
    await expect(rightPanel).toBeHidden({ timeout: 5_000 });
    await page.getByRole('button', { name: '展开右侧栏' }).click();
    await expect(rightPanel).toBeVisible({ timeout: 5_000 });

    await setWindowSize(app, 850, 768);
    await expect(rightPanel).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: '收起右侧栏' }).click();
    await expect(rightPanel).toBeHidden({ timeout: 5_000 });
    await page.getByRole('button', { name: '展开右侧栏' }).click();
    await expect(rightPanel).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: test.info().outputPath('layout-narrow.png'), fullPage: true });
  });
});

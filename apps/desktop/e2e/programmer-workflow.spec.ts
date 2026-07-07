import { expect, test } from "@playwright/test";
import { join } from "path";
import {
    ASSISTANT_REPLY,
    TEST_TIMEOUT_MS,
    USER_PROMPT,
    applyAssistantCodeChange,
    closeApp,
    expandRightRailIfNeeded,
    launchApp,
    openExistingProjectFromUi,
    runProjectTestInTerminal,
    sendProgrammerPrompt,
} from "./support/programmer-workflow";
import { prepareMiniNodeProject, readMiniProjectResult } from "./support/programmer-project";

test.describe("normal programmer real Electron workflow", () => {
    test.setTimeout(TEST_TIMEOUT_MS);

    test("implements a small code change, runs tests, inspects files and Git diff, then restores the session", async () => {
        const userDataDir = test.info().outputPath(`user-data-${Date.now()}`);
        const configDir = test.info().outputPath("pi-config");
        const workspaceParentPath = test.info().outputPath("workspace-parent");
        const projectName = `programmer-e2e-project-${Date.now()}`;
        const workspacePath = join(workspaceParentPath, projectName);
        const miniProject = prepareMiniNodeProject(workspacePath);

        let context: Awaited<ReturnType<typeof launchApp>> | undefined;
        try {
            context = await launchApp({ userDataDir, configDir, selectedWorkspacePath: workspacePath });
            await openExistingProjectFromUi(context.page, context.app, projectName, workspacePath);

            await sendProgrammerPrompt(context.page, context.app);
            await applyAssistantCodeChange(context.page, context.app, miniProject);
            await context.page.screenshot({
                path: test.info().outputPath("programmer-workflow-chat-development.png"),
                fullPage: true,
            });

            await runProjectTestInTerminal(context.page, miniProject.resultPath);
            expect(readMiniProjectResult(miniProject.resultPath)).toMatchObject({ passed: true, total: 79 });
            await context.page.screenshot({
                path: test.info().outputPath("programmer-workflow-terminal-test.png"),
                fullPage: true,
            });

            await expandRightRailIfNeeded(context.page);
            await context.page.getByRole("button", { name: "浏览全部文件" }).click();
            const fileSearch = context.page.getByRole("textbox", { name: "搜索文件" });
            await expect(fileSearch).toBeVisible({ timeout: 5_000 });

            await fileSearch.fill(".e2e-test-result");
            await expect(context.page.locator('button[title=".e2e-test-result.json"]')).toBeVisible({ timeout: 5_000 });
            await context.page.locator('button[title=".e2e-test-result.json"]').click();
            await expect(context.page.getByLabel("文件只读预览")).toContainText('"passed": true', { timeout: 5_000 });
            await context.page.screenshot({
                path: test.info().outputPath("programmer-workflow-test-result-preview.png"),
                fullPage: true,
            });

            await fileSearch.fill("cart.js");
            await expect(context.page.locator('button[title="src/cart.js"]')).toBeVisible({ timeout: 5_000 });
            await context.page.locator('button[title="src/cart.js"]').click();
            await expect(context.page.getByLabel("文件只读预览")).toContainText("BULK_DISCOUNT_THRESHOLD", { timeout: 5_000 });
            await context.page.screenshot({
                path: test.info().outputPath("programmer-workflow-file-preview.png"),
                fullPage: true,
            });

            await context.page.getByRole("tab", { name: "对话" }).click();
            await expandRightRailIfNeeded(context.page);
            await context.page.getByRole("button", { name: "提交或推送，打开 Git 面板" }).click();
            await expect(context.page.getByRole("region", { name: "Git 面板" })).toBeVisible({ timeout: 5_000 });
            await context.page.getByRole("button", { name: "刷新 Git 状态" }).click();
            await expect(context.page.getByText(/0 staged \/ 1 changes/)).toBeVisible({ timeout: 10_000 });
            await context.page.getByRole("button", { name: "打开 src/cart.js diff" }).click();
            await expect(context.page.getByText("BULK_DISCOUNT_THRESHOLD").first()).toBeVisible({ timeout: 10_000 });
            await context.page.screenshot({
                path: test.info().outputPath("programmer-workflow-git-diff.png"),
                fullPage: true,
            });

            await closeApp(context.app);

            context = await launchApp({ userDataDir, configDir, selectedWorkspacePath: workspacePath });
            await expect(context.page.getByRole("button", { name: `切换工作区：${projectName}` }).first()).toBeVisible();
            await expect(context.page.locator('article[aria-label^="你 ·"]').filter({ hasText: USER_PROMPT })).toBeVisible();
            await expect(context.page.locator('article[aria-label^="Pi ·"]').filter({ hasText: ASSISTANT_REPLY })).toBeVisible();
            await context.page.screenshot({
                path: test.info().outputPath("programmer-workflow-restored.png"),
                fullPage: true,
            });
        } finally {
            await closeApp(context?.app);
        }
    });
});

import { expect, test, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { electronMainEntry } from "../playwright.config";
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { getWindowByUrl } from "./support/electron-windows";

const SESSION_ID = "native-session-resume-e2e";
const MARKER = "PI_DESKTOP_NATIVE_SESSION_RESUME_MARKER";
type NativeSessionGlobals = typeof globalThis & { __PI_DESKTOP_TEST_AGENT_REGISTRY__?: {
    list: () => Array<{ id: string; sessionId?: string; sessionPath?: string }>;
    getWorkspaceSession: (id: string) => { session: {
        sessionFile?: string;
        messages: Array<{ role?: string; content?: Array<{ type?: string; text?: string }> }>;
        sessionManager: { getSessionFile: () => string | undefined; appendMessage: (message: Record<string, unknown>) => string };
    } };
} };

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const app = await _electron.launch({ executablePath: resolveElectronExecutablePath(), args: [`--user-data-dir=${userDataDir}`, electronMainEntry], env: { ...process.env, CI: "1", ELECTRON_RENDERER_URL: "" } });
    await getWindowByUrl(app, "index.html");
    return { app, page: await getWindowByUrl(app, "index.html") };
}
async function closeApp(app: ElectronApplication | undefined): Promise<void> {
    try { await app?.close(); } catch { /* Best-effort restart cleanup. */ }
}
async function waitForBoundAgent(page: Page): Promise<void> {
    await expect.poll(() => page.evaluate(async (sessionId) => (await window.piAPI.agentsList()).some((agent) => agent.sessionId === sessionId), SESSION_ID), { timeout: 20_000 }).toBe(true);
}
async function inspectNativeSession(app: ElectronApplication) {
    return app.evaluate((_electron, input) => {
        const registry = (globalThis as NativeSessionGlobals).__PI_DESKTOP_TEST_AGENT_REGISTRY__;
        if (!registry) throw new Error("Missing production agent registry test hook");
        const agent = registry.list().find((item) => item.sessionId === input.sessionId);
        if (!agent) throw new Error(`No production agent bound to ${input.sessionId}`);
        const session = registry.getWorkspaceSession(agent.id).session;
        return {
            agentPath: agent.sessionPath, managerPath: session.sessionManager.getSessionFile(), sessionFile: session.sessionFile,
            hasMarker: session.messages.some((message) => message.role === "user" && message.content?.some((part) => part.type === "text" && part.text === input.marker)),
        };
    }, { sessionId: SESSION_ID, marker: MARKER });
}

test.describe("Pi Desktop native Pi session resume", () => {
    let app: ElectronApplication | undefined;
    test.afterEach(async () => { await closeApp(app); app = undefined; });

    test("reopens the same JSONL for a desktop session id and restores its marker", async ({}, testInfo) => {
        const userDataDir = testInfo.outputPath("native-session-user-data");
        const workspacePath = testInfo.outputPath("native-session-workspace");
        await mkdir(workspacePath, { recursive: true });
        let launched = await launchApp(userDataDir); app = launched.app;
        await launched.page.evaluate(async (input) => {
            window.localStorage.setItem("pi-desktop:firstLaunchDone", "true");
            window.localStorage.setItem("pi-desktop.onboarding.completed", "true");
            const workspace = await window.piAPI.createWorkspace("native-session-resume", input.workspacePath);
            if ("code" in workspace) throw new Error(workspace.fallback);
            await window.piAPI.selectWorkspace(workspace.path);
            const session = await window.piAPI.createSession(workspace.id, "Native session resume", input.sessionId);
            await window.piAPI.agentsCreate({ workspaceId: workspace.id, sessionId: session.id });
        }, { workspacePath, sessionId: SESSION_ID });
        await waitForBoundAgent(launched.page);
        const before = await app.evaluate((_electron, input) => {
            const registry = (globalThis as NativeSessionGlobals).__PI_DESKTOP_TEST_AGENT_REGISTRY__;
            if (!registry) throw new Error("Missing production agent registry test hook");
            const agent = registry.list().find((item) => item.sessionId === input.sessionId);
            if (!agent) throw new Error(`No production agent bound to ${input.sessionId}`);
            const session = registry.getWorkspaceSession(agent.id).session;
            session.sessionManager.appendMessage({ role: "user", content: [{ type: "text", text: input.marker }], timestamp: Date.now() });
            session.sessionManager.appendMessage({
                role: "assistant",
                content: [{ type: "text", text: "marker persisted" }],
                api: "test",
                provider: "pi-desktop-e2e",
                model: "no-provider",
                usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
                stopReason: "stop",
                timestamp: Date.now(),
            });
            return { agentPath: agent.sessionPath, managerPath: session.sessionManager.getSessionFile(), sessionFile: session.sessionFile };
        }, { sessionId: SESSION_ID, marker: MARKER });
        expect(before.agentPath).toBeTruthy();
        expect(before.managerPath).toBe(before.agentPath);
        expect(before.sessionFile).toBe(before.agentPath);
        expect(await readFile(before.agentPath!, "utf8")).toContain(MARKER);
        await closeApp(app); app = undefined;
        launched = await launchApp(userDataDir); app = launched.app;
        await waitForBoundAgent(launched.page);
        const after = await inspectNativeSession(app);
        expect(after.agentPath).toBe(before.agentPath);
        expect(after.managerPath).toBe(before.agentPath);
        expect(after.sessionFile).toBe(before.agentPath);
        expect(after.hasMarker).toBe(true);
        expect(await readFile(after.agentPath!, "utf8")).toContain(MARKER);
    });
});

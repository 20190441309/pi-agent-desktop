import { expect, test, _electron, type ElectronApplication, type Page } from "@playwright/test";
import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { electronMainEntry } from "../playwright.config";
import { resolveElectronExecutablePath } from "./support/electron-launch";
import { getWindowByUrl } from "./support/electron-windows";

type RegistryGlobals = typeof globalThis & { __PI_DESKTOP_TEST_AGENT_REGISTRY__?: {
    syncPermissions: (id: string, mode?: "build" | "plan" | "compose") => Promise<{ activeTools: string[]; deniedTools: string[] }>;
    getWorkspaceSession: (id: string) => { session: {
        getActiveToolNames: () => string[];
        getToolDefinition: (name: string) => { execute: (...args: unknown[]) => Promise<unknown> } | undefined;
        extensionRunner: { createContext: () => unknown };
    } };
} };

async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
    const app = await _electron.launch({ executablePath: resolveElectronExecutablePath(), args: [`--user-data-dir=${userDataDir}`, electronMainEntry], env: { ...process.env, CI: "1", ELECTRON_RENDERER_URL: "" } });
    await getWindowByUrl(app, "index.html");
    return { app, page: await getWindowByUrl(app, "index.html") };
}

async function closeApp(app: ElectronApplication | undefined): Promise<void> {
    try { await app?.close(); } catch { /* Best-effort E2E teardown. */ }
}

async function createBoundAgent(page: Page, workspacePath: string, sessionId: string, permissions: Record<string, boolean>): Promise<string> {
    return page.evaluate(async (input) => {
        window.localStorage.setItem("pi-desktop:firstLaunchDone", "true");
        window.localStorage.setItem("pi-desktop.onboarding.completed", "true");
        const current = await window.piAPI.getSettings();
        await window.piAPI.setSettings({ permissionLevel: "always", longHorizon: { ...(current.longHorizon ?? {}), enabled: true, planMode: { enabled: true } } });
        const workspace = await window.piAPI.createWorkspace(`permission-${input.sessionId}`, input.workspacePath);
        if ("code" in workspace) throw new Error(workspace.fallback);
        await window.piAPI.selectWorkspace(workspace.path);
        const session = await window.piAPI.createSession(workspace.id, input.sessionId, input.sessionId);
        const updated = await window.piAPI.updateSessionMetadata(session.id, { toolPermissions: input.permissions });
        if ("code" in updated) throw new Error(updated.fallback);
        return (await window.piAPI.agentsCreate({ workspaceId: workspace.id, sessionId: session.id })).id;
    }, { workspacePath, sessionId, permissions });
}

async function executeWrite(app: ElectronApplication, agentId: string, mode: "build" | "plan", path: string) {
    return app.evaluate(async (_electron, input) => {
        const registry = (globalThis as RegistryGlobals).__PI_DESKTOP_TEST_AGENT_REGISTRY__;
        if (!registry) throw new Error("Missing production agent registry test hook");
        const sync = await registry.syncPermissions(input.agentId, input.mode);
        const runtime = registry.getWorkspaceSession(input.agentId).session;
        const write = runtime.getToolDefinition("write");
        if (!write) throw new Error("Production guarded write tool is unavailable");
        let writeError: string | null = null;
        try { await write.execute("permission-e2e", { path: input.path, content: "permission bypass" }, undefined, undefined, runtime.extensionRunner.createContext()); }
        catch (cause) { writeError = cause instanceof Error ? cause.message : String(cause); }
        return { ...sync, activeFromSession: runtime.getActiveToolNames(), writeError };
    }, { agentId, mode, path });
}

test.describe("Pi Desktop production permission enforcement", () => {
    let app: ElectronApplication | undefined;
    test.afterEach(async () => { await closeApp(app); app = undefined; });

    test("guarded write blocks before touching disk when fileWrite is disabled", async ({}, testInfo) => {
        const workspacePath = testInfo.outputPath("permission-write-workspace");
        await mkdir(workspacePath, { recursive: true });
        const launched = await launchApp(testInfo.outputPath("permission-write-user-data")); app = launched.app;
        const agentId = await createBoundAgent(launched.page, workspacePath, "permission-write-session", { fileRead: true, fileWrite: false, shell: true, git: true, network: true, extensions: true });
        const result = await executeWrite(app, agentId, "build", "must-not-exist.txt");
        expect(result.writeError).toContain("file write permission is disabled");
        await expect(access(join(workspacePath, "must-not-exist.txt"))).rejects.toThrow();
    });

    test("Plan removes mutation tools, keeps read/plan_write, and wins over always mode", async ({}, testInfo) => {
        const workspacePath = testInfo.outputPath("permission-plan-workspace");
        await mkdir(workspacePath, { recursive: true });
        const launched = await launchApp(testInfo.outputPath("permission-plan-user-data")); app = launched.app;
        const agentId = await createBoundAgent(launched.page, workspacePath, "permission-plan-session", { fileRead: true, fileWrite: true, shell: true, git: true, network: true, extensions: true });
        const result = await executeWrite(app, agentId, "plan", "plan-bypass.txt");
        expect(result.activeTools).toEqual(result.activeFromSession);
        expect(result.activeTools).toContain("read");
        expect(result.activeTools).toContain("plan_write");
        expect(result.activeTools).not.toEqual(expect.arrayContaining(["bash", "write", "edit"]));
        expect(result.deniedTools).toEqual(expect.arrayContaining(["bash", "write", "edit"]));
        expect(result.writeError).toContain("disabled in plan mode");
        await expect(access(join(workspacePath, "plan-bypass.txt"))).rejects.toThrow();
    });
});

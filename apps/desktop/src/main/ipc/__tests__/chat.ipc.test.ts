import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const listeners = new Map<string, (...args: unknown[]) => unknown>();
const webContentsSend = vi.fn();
const { execFileSyncMock, rmSyncMock } = vi.hoisted(() => ({
    execFileSyncMock: vi.fn(),
    rmSyncMock: vi.fn(),
}));

vi.mock("electron", () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers.set(channel, handler);
        }),
        on: vi.fn((channel: string, listener: (...args: unknown[]) => unknown) => {
            listeners.set(channel, listener);
        }),
    },
    BrowserWindow: {
        getAllWindows: vi.fn(() => [
            {
                isDestroyed: () => false,
                webContents: { send: webContentsSend },
            },
        ]),
    },
}));

vi.mock("electron-log/main", () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock("child_process", () => ({
    execFileSync: execFileSyncMock,
}));

vi.mock("fs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("fs")>();
    return {
        ...actual,
        rmSync: rmSyncMock,
    };
});

import { setupChatIpc } from "../chat.ipc";

describe("setupChatIpc", () => {
    beforeEach(() => {
        handlers.clear();
        listeners.clear();
        webContentsSend.mockClear();
        execFileSyncMock.mockReset();
        rmSyncMock.mockReset();
    });

    it("sends renderer event payload directly without a workspace envelope", async () => {
        const event = { type: "agent_start" };
        const registry = {
            get: vi.fn(async (_id, _path, _pendingEdits, send) => ({
                session: {
                    prompt: vi.fn(async () => {
                        send("pi:event", "ws_1", event);
                    }),
                    abort: vi.fn(),
                },
            })),
            has: vi.fn(() => true),
        };

        setupChatIpc({
            registry: registry as any,
            getWorkspace: () => ({ id: "ws_1", name: "demo", path: "C:/demo" }),
            getDefaultWorkspace: () => undefined,
            pendingEdits: { autoApprove: false } as any,
        });

        const handler = handlers.get("pi:send");
        expect(handler).toBeTruthy();

        await handler?.({}, "ws_1", "hello");

        expect(webContentsSend).toHaveBeenCalledWith("pi:event", event);
    });

    it("does not fall back to the default workspace when a provided workspace id is unknown", async () => {
        const registry = {
            get: vi.fn(),
            has: vi.fn(() => false),
        };

        setupChatIpc({
            registry: registry as any,
            getWorkspace: () => undefined,
            getDefaultWorkspace: () => ({ id: "default", name: "default", path: "C:/default" }),
            pendingEdits: { autoApprove: false } as any,
        });

        const handler = handlers.get("pi:send");
        const result = await handler?.({}, "missing_ws", "hello");

        expect(result).toMatchObject({
            code: "ipcErrors.chat.workspaceNotFound",
            params: { id: "missing_ws" },
        });
        expect(registry.get).not.toHaveBeenCalled();
    });

    it("does not stop the default workspace when the requested workspace id is unknown", async () => {
        const registry = {
            get: vi.fn(),
            has: vi.fn(() => true),
        };

        setupChatIpc({
            registry: registry as any,
            getWorkspace: () => undefined,
            getDefaultWorkspace: () => ({ id: "default", name: "default", path: "C:/default" }),
            pendingEdits: { autoApprove: false } as any,
        });

        const handler = handlers.get("pi:stop");
        const result = await handler?.({}, "missing_ws");

        expect(result).toMatchObject({
            code: "ipcErrors.chat.workspaceNotFound",
            params: { id: "missing_ws" },
        });
        expect(registry.has).not.toHaveBeenCalled();
        expect(registry.get).not.toHaveBeenCalled();
    });

    it("normalizes git undo paths before invoking git", async () => {
        setupChatIpc({
            registry: { get: vi.fn(), has: vi.fn() } as any,
            getWorkspace: () => undefined,
            getDefaultWorkspace: () => undefined,
            pendingEdits: { autoApprove: false } as any,
        });

        const handler = handlers.get("git:undo");
        const result = await handler?.({}, "C:/repo", "src\\app.ts");

        expect(result).toBeUndefined();
        expect(execFileSyncMock).toHaveBeenCalledWith("git", ["checkout", "--", "src/app.ts"], {
            cwd: expect.stringMatching(/[\\/]repo$/),
            stdio: "ignore",
        });
        expect(rmSyncMock).not.toHaveBeenCalled();
    });

    it("blocks git undo outside the workspace before running git or deleting files", async () => {
        setupChatIpc({
            registry: { get: vi.fn(), has: vi.fn() } as any,
            getWorkspace: () => undefined,
            getDefaultWorkspace: () => undefined,
            pendingEdits: { autoApprove: false } as any,
        });

        const handler = handlers.get("git:undo");
        const result = await handler?.({}, "C:/repo", "C:/outside/secret.txt");

        expect(result).toMatchObject({
            code: "ipcErrors.files.protectedPath",
        });
        expect(execFileSyncMock).not.toHaveBeenCalled();
        expect(rmSyncMock).not.toHaveBeenCalled();
    });

    it("blocks git undo for protected credential files inside the workspace", async () => {
        setupChatIpc({
            registry: { get: vi.fn(), has: vi.fn() } as any,
            getWorkspace: () => undefined,
            getDefaultWorkspace: () => undefined,
            pendingEdits: { autoApprove: false } as any,
        });

        const handler = handlers.get("git:undo");
        const result = await handler?.({}, "C:/repo", ".env.local");

        expect(result).toMatchObject({
            code: "ipcErrors.files.protectedPath",
        });
        expect(execFileSyncMock).not.toHaveBeenCalled();
        expect(rmSyncMock).not.toHaveBeenCalled();
    });

    it("uses Node deletion for untracked files after git checkout fallback fails", async () => {
        execFileSyncMock.mockImplementationOnce(() => {
            throw new Error("not tracked");
        });

        setupChatIpc({
            registry: { get: vi.fn(), has: vi.fn() } as any,
            getWorkspace: () => undefined,
            getDefaultWorkspace: () => undefined,
            pendingEdits: { autoApprove: false } as any,
        });

        const handler = handlers.get("git:undo");
        const result = await handler?.({}, "C:/repo", "src/new.ts");

        expect(result).toBeUndefined();
        expect(rmSyncMock).toHaveBeenCalledWith(expect.stringMatching(/[\\/]repo[\\/]src[\\/]new\.ts$/), { force: true });
    });
});

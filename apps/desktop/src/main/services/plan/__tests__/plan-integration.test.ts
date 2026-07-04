// Plan integration smoke tests for spec fix-plan-mode-foundation
// Verifies smoke checkpoints #2/#3/#4/#5 end-to-end:
//   #2: planCreate creates .pi/plans/ directory + file
//   #3: plan:complete moves file to completed/  (PlanCard.execute path)
//   #4: plan:delete moves file to cancelled/    (PlanCard.cancel path)
//   #5: planModeEnabled persists across simulated app restart
//
// Smoke #1 (directive injection) is covered by chat.ipc.test.ts:
//   "prepends the plan-mode directive when plan mode is enabled (CRIT-2)"
//
// Strategy:
//   - Mock electron (ipcMain.handle captures handlers) + electron-log/main
//   - Use the REAL PlanFileService + real temp workspace dirs
//   - For #2/#3/#4: wire real PlanFileService through setupPlanIpc and invoke
//     the IPC handlers (Zod validation + service round-trip)
//   - For #5: simulate electron-store with a file-backed mock so we can
//     reload state from disk between two "sessions" and verify persistence.
//     The setWorkspacePlanMode / getWorkspacePlanMode closures mirror the
//     production logic in main/index.ts verbatim (mutateWorkspaces chain +
//     workspace.planModeEnabled field).

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks: electron + electron-log/main ────────────────────────────────
// ipcMain.handle captures handlers into a Map so we can invoke them directly
// (matches the pattern in chat.ipc.test.ts). BrowserWindow.getAllWindows
// returns [] so the IpcSender inside setupChatIpc becomes a no-op.

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock("electron", () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers.set(channel, handler);
        }),
        on: vi.fn(),
    },
    BrowserWindow: {
        getAllWindows: vi.fn(() => []),
    },
}));

vi.mock("electron-log/main", () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

// ── Imports under test (after mocks are hoisted) ───────────────────────

import { PlanFileService } from "../plan-file-service";
import { setupPlanIpc } from "../../../ipc/plan.ipc";
import { setupChatIpc } from "../../../ipc/chat.ipc";

// ── Test helpers ────────────────────────────────────────────────────────

interface WorkspaceRecord {
    id: string;
    name: string;
    path: string;
    createdAt: number;
    lastActiveAt?: number;
    planModeEnabled?: boolean;
}

interface StoreData {
    schemaVersion: number;
    workspaces: WorkspaceRecord[];
    sessions: unknown[];
    settings: unknown;
}

type FileBackedStore = {
    get<TKey extends keyof StoreData>(key: TKey): StoreData[TKey];
    set<TKey extends keyof StoreData>(key: TKey, value: StoreData[TKey]): void;
};

/**
 * File-backed mock that mirrors the electron-store API surface used by
 * main/index.ts's setWorkspacePlanMode / getWorkspacePlanMode + chat.ipc's
 * getWorkspace. Every `set()` writes the full data to disk so a fresh
 * store reading the same JSON file picks up the change — this simulates
 * an app restart: a new electron-store instance reading the same file.
 *
 * Pass `initial` on the first call to seed the file; omit it on subsequent
 * calls to load the existing file unchanged.
 */
function createFileBackedMockStore(
    configPath: string,
    options?: { initial?: Partial<StoreData> },
): FileBackedStore {
    if (options?.initial) {
        const initialData: StoreData = {
            schemaVersion: 1,
            workspaces: [],
            sessions: [],
            settings: {},
            ...options.initial,
        };
        writeFileSync(configPath, JSON.stringify(initialData, null, 2), "utf8");
    }
    return {
        get(key) {
            const parsed = JSON.parse(readFileSync(configPath, "utf8")) as StoreData;
            return parsed[key];
        },
        set(key, value) {
            const parsed = JSON.parse(readFileSync(configPath, "utf8")) as StoreData;
            parsed[key] = value;
            writeFileSync(configPath, JSON.stringify(parsed, null, 2), "utf8");
        },
    };
}

/**
 * Mirrors the production closures in main/index.ts:
 *   - mutateWorkspaces: serial mutation chain on store.get('workspaces')
 *   - setWorkspacePlanMode: persists planModeEnabled on the workspace record
 *   - getWorkspacePlanMode: reads the persisted planModeEnabled value
 *   - getWorkspace: returns a WorkspaceLite for chat.ipc's deps
 *
 * The mutation logic is copied verbatim from main/index.ts so the test
 * exercises the same persistence pattern as production.
 */
function createWorkspacePlanModeFns(store: FileBackedStore) {
    let chain: Promise<unknown> = Promise.resolve();

    function mutateWorkspaces(
        fn: (current: WorkspaceRecord[]) => WorkspaceRecord[],
    ): Promise<WorkspaceRecord[]> {
        return new Promise((resolve, reject) => {
            chain = chain.then(() => {
                try {
                    const current = store.get("workspaces") ?? [];
                    const next = fn(current);
                    store.set("workspaces", next);
                    resolve(next);
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    async function setWorkspacePlanMode(workspaceId: string, enabled: boolean): Promise<void> {
        await mutateWorkspaces((current) =>
            current.map((workspace) =>
                workspace.id === workspaceId
                    ? {
                          ...workspace,
                          planModeEnabled: enabled,
                          lastActiveAt: workspace.lastActiveAt ?? Date.now(),
                      }
                    : workspace,
            ),
        );
    }

    function getWorkspacePlanMode(workspaceId: string): boolean | undefined {
        const workspace = store.get("workspaces").find((w) => w.id === workspaceId);
        return workspace?.planModeEnabled;
    }

    function getWorkspace(id: string) {
        const ws = store.get("workspaces").find((w) => w.id === id);
        return ws ? { id: ws.id, name: ws.name, path: ws.path } : undefined;
    }

    return { setWorkspacePlanMode, getWorkspacePlanMode, getWorkspace };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("plan integration smoke tests", () => {
    const tempDirs: string[] = [];

    beforeEach(() => {
        handlers.clear();
    });

    afterEach(() => {
        for (const dir of tempDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    function makeTempDir(prefix: string): string {
        const dir = mkdtempSync(join(tmpdir(), `pi-plan-int-${prefix}-`));
        tempDirs.push(dir);
        return dir;
    }

    // ── Smoke #2 ───────────────────────────────────────────────────────
    it("smoke #2: plan:create creates .pi/plans/ directory and file", async () => {
        const workspacePath = makeTempDir("ws2");
        const service = new PlanFileService();

        setupPlanIpc({
            planFileService: service,
            getWorkspace: () => ({ id: "ws_2", name: "demo", path: workspacePath }),
        });

        const handler = handlers.get("plan:create");
        expect(handler).toBeTruthy();

        const record = (await handler?.({}, {
            workspaceId: "ws_2",
            slug: "test-plan",
            title: "Test Plan",
            content: "# Goal\n\nDo the thing",
        })) as { filename: string; path: string };

        // .pi/plans/ directory was created
        expect(existsSync(join(workspacePath, ".pi", "plans"))).toBe(true);
        // File exists on disk
        expect(existsSync(join(workspacePath, ".pi", "plans", record.filename))).toBe(true);

        // Read back via the service: content + metadata persisted correctly
        const read = service.read(workspacePath, record.filename);
        expect(read?.title).toBe("Test Plan");
        expect(read?.status).toBe("draft");
        expect(read?.content).toContain("# Goal");
    });

    // ── Smoke #3 ───────────────────────────────────────────────────────
    it("smoke #3: plan:complete moves plan to completed/ subdirectory", async () => {
        const workspacePath = makeTempDir("ws3");
        const service = new PlanFileService();

        setupPlanIpc({
            planFileService: service,
            getWorkspace: () => ({ id: "ws_3", name: "demo", path: workspacePath }),
        });

        const createHandler = handlers.get("plan:create");
        const created = (await createHandler?.({}, {
            workspaceId: "ws_3",
            slug: "p",
            title: "P",
            content: "x",
        })) as { filename: string };

        const completeHandler = handlers.get("plan:complete");
        const completed = (await completeHandler?.({}, {
            workspaceId: "ws_3",
            filename: created.filename,
        })) as { status: string; filename: string };

        expect(completed.status).toBe("completed");
        // Source path no longer exists
        expect(existsSync(join(workspacePath, ".pi", "plans", created.filename))).toBe(false);
        // Target path exists under completed/
        expect(
            existsSync(join(workspacePath, ".pi", "plans", "completed", created.filename)),
        ).toBe(true);
    });

    // ── Smoke #4 ───────────────────────────────────────────────────────
    it("smoke #4: plan:delete moves plan to cancelled/ subdirectory", async () => {
        const workspacePath = makeTempDir("ws4");
        const service = new PlanFileService();

        setupPlanIpc({
            planFileService: service,
            getWorkspace: () => ({ id: "ws_4", name: "demo", path: workspacePath }),
        });

        const createHandler = handlers.get("plan:create");
        const created = (await createHandler?.({}, {
            workspaceId: "ws_4",
            slug: "p",
            title: "P",
            content: "x",
        })) as { filename: string };

        const deleteHandler = handlers.get("plan:delete");
        const result = await deleteHandler?.({}, {
            workspaceId: "ws_4",
            filename: created.filename,
        });
        expect(result).toBeUndefined();

        // Source path no longer exists
        expect(existsSync(join(workspacePath, ".pi", "plans", created.filename))).toBe(false);
        // Target path exists under cancelled/
        expect(
            existsSync(join(workspacePath, ".pi", "plans", "cancelled", created.filename)),
        ).toBe(true);

        // Verify status is "cancelled" in the moved file
        const list = service.list(workspacePath, { includeCancelled: true });
        const moved = list.find((r) => r.filename === created.filename);
        expect(moved?.status).toBe("cancelled");
    });

    // ── Smoke #5 ───────────────────────────────────────────────────────
    it("smoke #5: planModeEnabled persists across simulated restart", async () => {
        const configPath = join(makeTempDir("cfg5"), "config.json");
        const workspacePath = makeTempDir("ws5");

        // Session 1: seed a workspace record so setWorkspacePlanMode has something to mutate
        const store1 = createFileBackedMockStore(configPath, {
            initial: {
                workspaces: [
                    {
                        id: "ws_5",
                        name: "demo",
                        path: workspacePath,
                        createdAt: Date.now(),
                    },
                ],
            },
        });
        const fns1 = createWorkspacePlanModeFns(store1);

        setupChatIpc({
            registry: { get: vi.fn(), has: vi.fn() } as any,
            agentRegistry: { refreshWorkspace: vi.fn(async () => undefined) } as any,
            getWorkspace: fns1.getWorkspace,
            getDefaultWorkspace: () => undefined,
            pendingEdits: { autoApprove: false } as any,
            setWorkspacePlanMode: fns1.setWorkspacePlanMode,
            getWorkspacePlanMode: fns1.getWorkspacePlanMode,
        });

        // Before toggle: no per-workspace override → undefined (falls back to global)
        expect(fns1.getWorkspacePlanMode("ws_5")).toBeUndefined();

        // Toggle ON via the production IPC handler (plan:set-enabled).
        // This is the same handler the renderer calls when the user clicks
        // the "启用 plan 模式" toggle.
        const planHandler = handlers.get("plan:set-enabled");
        expect(planHandler).toBeTruthy();
        const result = await planHandler?.({}, "ws_5", true);
        expect(result).toBeUndefined();

        // Session 1 observes the persisted value in-memory
        expect(fns1.getWorkspacePlanMode("ws_5")).toBe(true);

        // Verify the JSON file on disk actually contains planModeEnabled: true
        // (this is what would survive an app restart in production via electron-store)
        const parsed1 = JSON.parse(readFileSync(configPath, "utf8")) as StoreData;
        const ws1Record = parsed1.workspaces.find((w) => w.id === "ws_5");
        expect(ws1Record?.planModeEnabled).toBe(true);

        // Simulate app restart: new store reading the SAME file (no re-seed).
        // A fresh electron-store instance in production would also read the
        // existing config.json without overwriting it.
        const store2 = createFileBackedMockStore(configPath);
        const fns2 = createWorkspacePlanModeFns(store2);

        // Session 2 reads the persisted value — no re-toggle needed.
        // If persistence is broken (e.g. setWorkspacePlanMode never wrote to
        // the workspace record), this would return undefined.
        expect(fns2.getWorkspacePlanMode("ws_5")).toBe(true);
    });
});

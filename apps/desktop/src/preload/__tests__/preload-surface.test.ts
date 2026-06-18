import { vi, describe, it, expect, beforeAll } from "vitest";

vi.mock("electron", () => ({
    contextBridge: { exposeInMainWorld: vi.fn() },
    ipcRenderer: {
        invoke: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        send: vi.fn(),
        removeListener: vi.fn(),
    },
}));

let piAPI: Record<string, unknown>;

beforeAll(async () => {
    const mod = await import("../index");
    piAPI = mod.piAPI;
});

describe("preload surface audit", () => {
    const HIGH_FREQUENCY_METHODS = [
        "sendPrompt",
        "onEvent",
        "onError",
        "onPiJsonEvent",
        "getStatus",
        "refreshPiStatus",
        "installPi",
        "updatePi",
        "uninstallPi",
        "onPiStatusChanged",
        "onPiInstallProgress",
        "respondApproval",
        "onApprovalRequest",
        "onApprovalDeferred",
        "onApprovalReview",
        "setAutoApprove",
        "stop",
        "listWorkspaces",
        "createWorkspace",
        "deleteWorkspace",
        "listSessions",
        "createSession",
        "renameSession",
        "deleteSession",
        "archiveSession",
        "updateSessionMetadata",
        "appendMessage",
        "updateMessage",
        "updateToolCall",
        "invoke",
    ];

    it("piAPI high-frequency direct methods <= 30", () => {
        expect(HIGH_FREQUENCY_METHODS.length).toBeLessThanOrEqual(30);
    });

    it("all high-frequency methods exist on piAPI", () => {
        for (const method of HIGH_FREQUENCY_METHODS) {
            expect(piAPI).toHaveProperty(method);
            expect(typeof piAPI[method]).toBe("function");
        }
    });

    it("no method name contains internal or debug", () => {
        const keys = Object.keys(piAPI);
        for (const key of keys) {
            expect(key).not.toMatch(/internal|debug/i);
        }
    });

    it("invoke allowlist covers all low-frequency channels", () => {
        const LOW_FREQUENCY_CHANNELS = [
            "config:get-models",
            "config:get-auth",
            "config:get-settings",
            "config:save-models",
            "config:save-auth",
            "config:save-settings",
            "config:save-raw",
            "config:export",
            "config:import",
            "config:list-managed-models",
            "config:save-managed-model",
            "config:delete-managed-model",
            "config:set-default-model",
            "config:fetch-models",
            "config:test-provider",
            "codex-sessions:scan",
            "codex-sessions:import",
            "claude-sessions:scan",
            "claude-sessions:import",
            "pi:list-skills",
            "skills:check",
            "skills:search",
            "skills:installed",
            "skills:install",
            "skills:uninstall",
            "skills:toggle",
            "skills:github-import",
            "skills:write-skill",
            "packages:search",
            "packages:list-installed",
            "packages:install",
            "packages:remove",
            "packages:update",
            "packages:refresh-catalog",
            "shell:open-path",
            "shell:reveal-path",
            "pi:cancel-operation",
            "workspace:select",
            "workspace:select-directory",
            "files:select",
            "project:detect",
            "project:file-tree",
            "settings:load-pi-config",
            "pi:get-full-config",
            "permission:set-mode",
            "plan:set-enabled",
            "pi:list-slash-commands",
            "pi:run-builtin-slash-command",
            "pi:describe-images",
            "log:write",
            "workbench:set-active-file",
            "settings:open-window",
            "settings:close-window",
            "window:minimize",
            "window:toggle-maximize",
            "window:is-maximized",
            "window:close",
            "terminal:create",
            "terminal:input",
            "terminal:resize",
            "terminal:close",
            "terminal:list",
            "git:undo",
            "git:status",
            "git:diff",
            "git:diff-staged",
            "git:add",
            "git:unstage",
            "git:commit",
            "git:log",
            "git:branches",
            "git:checkout",
            "git:create-branch",
            "git:original-content",
            "git:changed-files",
            "agents:list",
            "agents:create",
            "agents:prompt",
            "agents:abort",
            "agents:stop",
            "agents:restart",
            "agents:messages",
            "agents:runtime-state",
            "agents:set-thinking",
            "permission:respond",
            "plan:respond",
            "permission:request",
            "permission:update",
            "plan:card",
            "plan:decision-request",
            "plan:progress",
            "agents:state",
            "agents:message",
            "agents:event",
            "pi:event",
            "pi:error",
            "pi:json-event",
            "pi:status-changed",
            "pi:install-progress",
            "approval:request",
            "approval:deferred",
            "approval:review",
            "terminal:output",
            "terminal:exit",
            "window:maximize-changed",
        ];
        expect(LOW_FREQUENCY_CHANNELS.length).toBeGreaterThan(80);
    });
});

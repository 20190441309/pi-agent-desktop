import { beforeEach, describe, expect, it, vi } from "vitest";

const webContentsSend = vi.fn();

vi.mock("electron", () => ({
    BrowserWindow: class MockBrowserWindow {
        isDestroyed = () => false;
        webContents = { send: webContentsSend };
    },
}));

import {
    _pendingCount,
    clearAllPendingApprovals,
    requestApproval,
    setWorkspaceWindow,
} from "../approval-bridge";
import { BrowserWindow } from "electron";

describe("clearAllPendingApprovals (E-004 window-close recovery)", () => {
    beforeEach(() => {
        clearAllPendingApprovals();
        webContentsSend.mockReset();
        vi.useRealTimers();
    });

    it("rejects every pending approval as false so agents do not hang on window close", async () => {
        const win = new BrowserWindow() as unknown as BrowserWindow;
        setWorkspaceWindow("ws-a", win);
        setWorkspaceWindow("ws-b", win);

        const p1 = requestApproval({
            method: "confirm",
            title: "run",
            message: "rm -rf /",
            workspaceId: "ws-a",
            timeoutMs: 60_000,
        });
        const p2 = requestApproval({
            method: "confirm",
            title: "write",
            message: "secret",
            workspaceId: "ws-b",
            timeoutMs: 60_000,
        });

        expect(_pendingCount()).toBe(2);

        clearAllPendingApprovals();

        await expect(p1).resolves.toBe(false);
        await expect(p2).resolves.toBe(false);
        expect(_pendingCount()).toBe(0);
    });

    it("is idempotent when called with an empty pending map", () => {
        expect(() => clearAllPendingApprovals()).not.toThrow();
        expect(_pendingCount()).toBe(0);
    });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock("electron", () => ({
  ipcMain: {
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    }),
  },
}));

import { setupDesktopOverlayIpc } from "../desktop-overlay.ipc";

describe("setupDesktopOverlayIpc", () => {
  beforeEach(() => {
    handlers.clear();
  });

  it("forwards set-main-context and set-window-state to the manager", () => {
    const manager = {
      setMainContext: vi.fn(),
      updateWindowState: vi.fn(),
    };
    setupDesktopOverlayIpc(manager as never);

    expect(handlers.has("desktop-overlay:set-main-context")).toBe(true);
    expect(handlers.has("desktop-overlay:set-window-state")).toBe(true);

    const ctx = { workspaceId: "w1", sessionId: "s1" };
    handlers.get("desktop-overlay:set-main-context")!({}, ctx);
    expect(manager.setMainContext).toHaveBeenCalledWith(ctx);

    const state = { visible: true, progress: 0.5 };
    handlers.get("desktop-overlay:set-window-state")!({}, state);
    expect(manager.updateWindowState).toHaveBeenCalledWith(state);
  });
});

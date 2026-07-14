import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  windows: [] as Array<{
    hide: ReturnType<typeof vi.fn>;
    showInactive: ReturnType<typeof vi.fn>;
    isVisible: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("electron", () => ({
  BrowserWindow: class {
    hide = vi.fn();
    showInactive = vi.fn();
    isVisible = vi.fn(() => false);
    isDestroyed = vi.fn(() => false);
    setAlwaysOnTop = vi.fn();
    setVisibleOnAllWorkspaces = vi.fn();
    setBounds = vi.fn();
    loadFile = vi.fn(async () => undefined);
    loadURL = vi.fn(async () => undefined);
    destroy = vi.fn();
    on = vi.fn();

    constructor() {
      electronMocks.windows.push(this);
    }
  },
  screen: {
    getPrimaryDisplay: vi.fn(() => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    })),
    getDisplayMatching: vi.fn(() => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    })),
  },
}));

vi.mock("@electron-toolkit/utils", () => ({
  is: { dev: false },
}));

vi.mock("../web-security", () => ({
  attachWebSecurityHandlers: vi.fn(),
}));

import { DesktopOverlayWindowManager } from "../desktop-overlay-window";

describe("desktop overlay visibility policy", () => {
  beforeEach(() => {
    electronMocks.windows.length = 0;
  });

  it("does not show progress reminders after the main window is hidden by default", () => {
    const manager = new DesktopOverlayWindowManager(() => ({
      isDestroyed: () => false,
      isVisible: () => false,
      getBounds: () => ({ x: 0, y: 0, width: 900, height: 700 }),
    }) as never);
    electronMocks.windows[0]?.showInactive.mockClear();

    manager.updateWindowState({ visible: true, width: 336, height: 96 });

    expect(electronMocks.windows).toHaveLength(1);
    expect(electronMocks.windows[0]?.showInactive).not.toHaveBeenCalled();
    expect(electronMocks.windows[0]?.hide).toHaveBeenCalled();
  });

  it("still supports an explicit opt-in for hidden-window progress surfaces", () => {
    const manager = new DesktopOverlayWindowManager(
      () => ({
        isDestroyed: () => false,
        isVisible: () => false,
        getBounds: () => ({ x: 0, y: 0, width: 900, height: 700 }),
      }) as never,
      { showWhenMainWindowHidden: true },
    );
    electronMocks.windows[0]?.showInactive.mockClear();

    manager.updateWindowState({ visible: true, width: 336, height: 96 });

    expect(electronMocks.windows[0]?.showInactive).toHaveBeenCalled();
  });
});

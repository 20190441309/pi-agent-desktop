import { describe, expect, it, vi } from "vitest";
import { createMainWindowLifecycleController } from "../window-lifecycle";

type CloseListener = (event: { preventDefault: () => void }) => void;
type VoidListener = () => void;

function createFakeWindow() {
  const listeners = new Map<string, Array<CloseListener | VoidListener>>();
  let visible = true;
  let minimized = false;
  return {
    on: vi.fn((event: string, listener: CloseListener | VoidListener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    }),
    emitClose(event: { preventDefault: () => void }) {
      for (const listener of listeners.get("close") ?? []) {
        (listener as CloseListener)(event);
      }
    },
    emit(event: "show" | "hide") {
      for (const listener of listeners.get(event) ?? []) {
        (listener as VoidListener)();
      }
    },
    hide: vi.fn(() => {
      visible = false;
    }),
    show: vi.fn(() => {
      visible = true;
    }),
    focus: vi.fn(),
    restore: vi.fn(() => {
      minimized = false;
    }),
    isDestroyed: vi.fn(() => false),
    isVisible: vi.fn(() => visible),
    isMinimized: vi.fn(() => minimized),
    __setMinimized(next: boolean) {
      minimized = next;
    },
  };
}

function createFakeTray() {
  const listeners = new Map<string, Array<VoidListener>>();
  return {
    on: vi.fn((event: string, listener: VoidListener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    }),
    emit(event: string) {
      for (const listener of listeners.get(event) ?? []) {
        listener();
      }
    },
    destroy: vi.fn(),
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
  };
}

describe("createMainWindowLifecycleController", () => {
  it("intercepts the main window close button and hides to tray instead", () => {
    const mainWindow = createFakeWindow();
    const overlay = { refreshVisibility: vi.fn(), destroy: vi.fn() };
    const controller = createMainWindowLifecycleController({
      getMainWindow: () => mainWindow,
      overlay,
      createTray: vi.fn(() => createFakeTray()),
      buildTrayMenu: vi.fn(() => ({ items: [] })),
      onQuitRequested: vi.fn(),
    });

    controller.attachMainWindow(mainWindow);
    const preventDefault = vi.fn();
    mainWindow.emitClose({ preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(mainWindow.hide).toHaveBeenCalled();
    expect(overlay.refreshVisibility).toHaveBeenCalled();
  });

  it("restores and focuses the main window when the tray icon is clicked", () => {
    const mainWindow = createFakeWindow();
    mainWindow.__setMinimized(true);
    const tray = createFakeTray();
    const beforeShowMainWindow = vi.fn();
    const controller = createMainWindowLifecycleController({
      getMainWindow: () => mainWindow,
      overlay: { refreshVisibility: vi.fn(), destroy: vi.fn() },
      createTray: vi.fn(() => tray),
      buildTrayMenu: vi.fn(() => ({ items: [] })),
      onQuitRequested: vi.fn(),
      beforeShowMainWindow,
    });

    controller.attachMainWindow(mainWindow);
    controller.ensureTray("C:/icon.ico");
    tray.emit("click");

    expect(beforeShowMainWindow).toHaveBeenCalled();
    expect(mainWindow.restore).toHaveBeenCalled();
    expect(mainWindow.show).toHaveBeenCalled();
    expect(mainWindow.focus).toHaveBeenCalled();
  });

  it("allows explicit quit to destroy tray resources and stop intercepting close", () => {
    const mainWindow = createFakeWindow();
    const tray = createFakeTray();
    const overlay = { refreshVisibility: vi.fn(), destroy: vi.fn() };
    const onQuitRequested = vi.fn();
    const controller = createMainWindowLifecycleController({
      getMainWindow: () => mainWindow,
      overlay,
      createTray: vi.fn(() => tray),
      buildTrayMenu: vi.fn(() => ({ items: [] })),
      onQuitRequested,
    });

    controller.attachMainWindow(mainWindow);
    controller.ensureTray("C:/icon.ico");
    controller.requestQuit();

    const preventDefault = vi.fn();
    mainWindow.emitClose({ preventDefault });

    expect(onQuitRequested).toHaveBeenCalled();
    expect(tray.destroy).toHaveBeenCalled();
    expect(overlay.destroy).toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

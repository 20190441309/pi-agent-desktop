import type { NativeImage } from "electron";

type CloseEventLike = {
  preventDefault(): void;
};

type TrayIconLike = string | NativeImage;

type MainWindowLike = {
  on(event: "close" | "show" | "hide", listener: ((event: CloseEventLike) => void) | (() => void)): void;
  hide(): void;
  show(): void;
  focus(): void;
  restore(): void;
  isDestroyed(): boolean;
  isVisible(): boolean;
  isMinimized(): boolean;
};

type TrayLike = {
  on(event: "click", listener: () => void): void;
  destroy(): void;
  setToolTip(text: string): void;
  setContextMenu(menu: unknown): void;
};

type OverlayLifecycleLike = {
  refreshVisibility(): void;
  destroy(): void;
};

interface MainWindowLifecycleControllerOptions {
  getMainWindow: () => MainWindowLike | null;
  overlay?: OverlayLifecycleLike | null;
  createTray: (icon: TrayIconLike) => TrayLike;
  buildTrayMenu: (actions: { show: () => void; quit: () => void }) => unknown;
  onQuitRequested: () => void;
  beforeShowMainWindow?: () => void;
}

export interface MainWindowLifecycleController {
  attachMainWindow(win: MainWindowLike): void;
  ensureTray(icon: TrayIconLike): TrayLike;
  hasTray(): boolean;
  restoreMainWindow(): void;
  beginQuit(): void;
  requestQuit(): void;
  isQuitting(): boolean;
}

export function createMainWindowLifecycleController(
  options: MainWindowLifecycleControllerOptions,
): MainWindowLifecycleController {
  let tray: TrayLike | null = null;
  let quitting = false;

  const syncOverlayVisibility = (): void => {
    options.overlay?.refreshVisibility();
  };

  const restoreMainWindow = (): void => {
    const win = options.getMainWindow();
    if (!win || win.isDestroyed()) return;
    options.beforeShowMainWindow?.();
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
    syncOverlayVisibility();
  };

  const beginQuit = (): void => {
    if (quitting) return;
    quitting = true;
    tray?.destroy();
    tray = null;
    options.overlay?.destroy();
  };

  const requestQuit = (): void => {
    if (quitting) return;
    beginQuit();
    options.onQuitRequested();
  };

  return {
    attachMainWindow(win) {
      win.on("close", (event) => {
        if (quitting) return;
        event.preventDefault();
        win.hide();
        syncOverlayVisibility();
      });
      win.on("show", syncOverlayVisibility);
      win.on("hide", syncOverlayVisibility);
    },
    ensureTray(icon) {
      if (tray) return tray;
      tray = options.createTray(icon);
      tray.setToolTip("Pi Desktop");
      tray.setContextMenu(options.buildTrayMenu({
        show: restoreMainWindow,
        quit: requestQuit,
      }));
      tray.on("click", restoreMainWindow);
      return tray;
    },
    hasTray() {
      return Boolean(tray);
    },
    restoreMainWindow,
    beginQuit,
    requestQuit,
    isQuitting() {
      return quitting;
    },
  };
}

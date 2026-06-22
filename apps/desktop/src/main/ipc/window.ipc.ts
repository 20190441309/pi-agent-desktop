import { BrowserWindow, ipcMain, type IpcMainInvokeEvent, type Rectangle } from 'electron';
import type { BrowserWindow as BrowserWindowType } from 'electron';

const trackedMaximizedState = new WeakMap<BrowserWindowType, boolean>();
const normalBoundsBeforeMaximize = new WeakMap<BrowserWindowType, Rectangle>();

function windowFromEvent(event: IpcMainInvokeEvent): BrowserWindowType | null {
  return BrowserWindow.fromWebContents(event.sender);
}

export function setupWindowIpc(getMainWindow: () => BrowserWindowType | null): void {
  ipcMain.handle("window:minimize", (event) => {
    const win = windowFromEvent(event) ?? getMainWindow();
    if (win && !win.isDestroyed()) win.minimize();
  });

  ipcMain.handle("window:toggle-maximize", (event) => {
    const win = windowFromEvent(event) ?? getMainWindow();
    if (!win || win.isDestroyed()) return;
    const isMaximized = trackedMaximizedState.get(win) ?? win.isMaximized();
    if (isMaximized) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        const bounds = normalBoundsBeforeMaximize.get(win);
        if (bounds) win.setBounds(bounds);
      }
      normalBoundsBeforeMaximize.delete(win);
      trackedMaximizedState.set(win, false);
      win.webContents.send("window:maximize-changed", false);
    } else {
      normalBoundsBeforeMaximize.set(win, win.getBounds());
      win.maximize();
      trackedMaximizedState.set(win, true);
      win.webContents.send("window:maximize-changed", true);
    }
  });

  ipcMain.handle("window:is-maximized", (event) => {
    const win = windowFromEvent(event) ?? getMainWindow();
    return win && !win.isDestroyed() ? trackedMaximizedState.get(win) ?? win.isMaximized() : false;
  });

  ipcMain.handle("window:close", (event) => {
    const win = windowFromEvent(event) ?? getMainWindow();
    if (win && !win.isDestroyed()) win.close();
  });
}

export function setupWindowEvents(getMainWindow: () => BrowserWindowType | null): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    const sendMaximizeState = (maximized: boolean): void => {
      const w = getMainWindow();
      if (w && !w.isDestroyed()) {
        trackedMaximizedState.set(w, maximized);
        w.webContents.send("window:maximize-changed", maximized);
      }
    };
    win.on("maximize", () => sendMaximizeState(true));
    win.on("unmaximize", () => sendMaximizeState(false));
  }
}

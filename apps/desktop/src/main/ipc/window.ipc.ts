import { ipcMain, type BrowserWindow } from 'electron';

export function setupWindowIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle("window:minimize", () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.minimize();
  });

  ipcMain.handle("window:toggle-maximize", () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle("window:is-maximized", () => {
    const win = getMainWindow();
    return win && !win.isDestroyed() ? win.isMaximized() : false;
  });

  ipcMain.handle("window:close", () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.close();
  });
}

export function setupWindowEvents(getMainWindow: () => BrowserWindow | null): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    const sendMaximizeState = (maximized: boolean): void => {
      const w = getMainWindow();
      if (w && !w.isDestroyed()) {
        w.webContents.send("window:maximize-changed", maximized);
      }
    };
    win.on("maximize", () => sendMaximizeState(true));
    win.on("unmaximize", () => sendMaximizeState(false));
  }
}

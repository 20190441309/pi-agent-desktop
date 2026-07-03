import { BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import log from 'electron-log/main';

let settingsWindow: BrowserWindow | null = null;

const SETTINGS_WINDOW_WIDTH = 1067;
const SETTINGS_WINDOW_HEIGHT = 800;
const SETTINGS_WINDOW_MIN_WIDTH = 960;
const SETTINGS_WINDOW_MIN_HEIGHT = 694;

export function setupSettingsWindowIpc(getMainWindow?: () => BrowserWindow | null): void {
  ipcMain.handle('settings:open-window', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.focus();
      return;
    }

    settingsWindow = new BrowserWindow({
      width: SETTINGS_WINDOW_WIDTH,
      height: SETTINGS_WINDOW_HEIGHT,
      minWidth: SETTINGS_WINDOW_MIN_WIDTH,
      minHeight: SETTINGS_WINDOW_MIN_HEIGHT,
      resizable: true,
      title: '系统设置',
      modal: false,
      show: false,
      autoHideMenuBar: true,
      transparent: process.platform === "win32",
      backgroundColor: "#00000000",
      ...(process.platform === "darwin"
        ? { titleBarStyle: "hiddenInset" as const, frame: true }
        : { frame: false }),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const mainWindow = getMainWindow?.();
    if (mainWindow && !mainWindow.isDestroyed()) {
      const mainBounds = mainWindow.getBounds();
      const workArea = screen.getDisplayMatching(mainBounds).workArea;
      const centeredX = mainBounds.x + Math.round((mainBounds.width - SETTINGS_WINDOW_WIDTH) / 2);
      const centeredY = mainBounds.y + Math.round((mainBounds.height - SETTINGS_WINDOW_HEIGHT) / 2);
      const maxX = Math.max(workArea.x, workArea.x + workArea.width - SETTINGS_WINDOW_WIDTH);
      const maxY = Math.max(workArea.y, workArea.y + workArea.height - SETTINGS_WINDOW_HEIGHT);
      settingsWindow.setBounds({
        x: Math.min(Math.max(centeredX, workArea.x), maxX),
        y: Math.min(Math.max(centeredY, workArea.y), maxY),
        width: SETTINGS_WINDOW_WIDTH,
        height: SETTINGS_WINDOW_HEIGHT,
      });
    }
    settingsWindow.webContents.setZoomFactor(1.5);

    settingsWindow.on('ready-to-show', () => {
      settingsWindow?.show();
    });

    settingsWindow.on('closed', () => {
      settingsWindow = null;
    });

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      void settingsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/settings.html`);
    } else {
      void settingsWindow.loadFile(join(__dirname, '../renderer/settings.html'));
    }

    log.info('[SettingsWindow] Opened settings window');
  });

  ipcMain.handle('settings:close-window', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
  });
}

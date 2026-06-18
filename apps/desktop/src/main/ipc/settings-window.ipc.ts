import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import log from 'electron-log/main';

let settingsWindow: BrowserWindow | null = null;

export function setupSettingsWindowIpc(): void {
  ipcMain.handle('settings:open-window', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.focus();
      return;
    }

    settingsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      resizable: true,
      title: '系统设置',
      modal: false,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

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

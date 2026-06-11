import { ipcMain } from 'electron';
import log from 'electron-log/main';
import { ipcError } from '@shared';
import type { PiDriver } from '../pi-driver';

export function setupPiDriverIpc(getPiDriver: () => PiDriver | null): void {
  ipcMain.handle('pi:status', async () => {
    const piDriver = getPiDriver();
    if (!piDriver) {
      return ipcError("ipcErrors.pi.driverNotInitialized", "PiDriver 尚未初始化");
    }
    return piDriver.detectSync();
  });

  ipcMain.handle('pi:refresh-status', async () => {
    const piDriver = getPiDriver();
    if (!piDriver) {
      return ipcError("ipcErrors.pi.driverNotInitialized", "PiDriver 尚未初始化");
    }
    try {
      return await piDriver.detect();
    } catch (err) {
      log.error("[pi-driver.ipc] pi:refresh-status failed:", err);
      return ipcError(
        "ipcErrors.pi.detectFailed",
        `Pi 状态检测失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('pi:install', async () => {
    const piDriver = getPiDriver();
    if (!piDriver) {
      return ipcError("ipcErrors.pi.driverNotInitialized", "PiDriver 尚未初始化");
    }
    try {
      await piDriver.install();
      return piDriver.detectSync();
    } catch (err) {
      log.error("[pi-driver.ipc] pi:install failed:", err);
      return ipcError(
        "ipcErrors.pi.installFailed",
        `安装 Pi CLI 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('pi:update', async () => {
    const piDriver = getPiDriver();
    if (!piDriver) {
      return ipcError("ipcErrors.pi.driverNotInitialized", "PiDriver 尚未初始化");
    }
    try {
      await piDriver.update();
      return piDriver.detectSync();
    } catch (err) {
      log.error("[pi-driver.ipc] pi:update failed:", err);
      return ipcError(
        "ipcErrors.pi.updateFailed",
        `更新 Pi CLI 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('pi:uninstall', async () => {
    const piDriver = getPiDriver();
    if (!piDriver) {
      return ipcError("ipcErrors.pi.driverNotInitialized", "PiDriver 尚未初始化");
    }
    try {
      await piDriver.uninstall();
      return piDriver.detectSync();
    } catch (err) {
      log.error("[pi-driver.ipc] pi:uninstall failed:", err);
      return ipcError(
        "ipcErrors.pi.uninstallFailed",
        `卸载 Pi CLI 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('pi:cancel-operation', async () => {
    getPiDriver()?.cancelOperation();
  });
}

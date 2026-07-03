import { ipcMain } from "electron";
import type { DesktopOverlayMainContext, DesktopOverlayWindowManager, DesktopOverlayWindowState } from "../services/desktop-overlay-window";

export function setupDesktopOverlayIpc(manager: DesktopOverlayWindowManager): void {
    ipcMain.on("desktop-overlay:set-main-context", (_event, payload: DesktopOverlayMainContext) => {
        manager.setMainContext(payload);
    });

    ipcMain.on("desktop-overlay:set-window-state", (_event, payload: DesktopOverlayWindowState) => {
        manager.updateWindowState(payload);
    });
}

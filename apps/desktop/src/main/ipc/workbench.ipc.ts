import { ipcMain } from 'electron';
import log from 'electron-log/main';
import { workbenchSetActiveFileSchema } from './schemas';

const workbenchContext = new Map<string, string | null>();

export function getWorkbenchContext(workspaceId: string): string | null {
    return workbenchContext.get(workspaceId) ?? null;
}

export function setupWorkbenchIpc(): void {
    ipcMain.on("workbench:set-active-file", (_event, workspaceId: string, filePath: string | null) => {
        workbenchSetActiveFileSchema.parse([workspaceId, filePath]);
        workbenchContext.set(workspaceId, filePath);
        log.info(`[workbench] active file for workspace ${workspaceId}: ${filePath ?? '(none)'}`);
    });
}
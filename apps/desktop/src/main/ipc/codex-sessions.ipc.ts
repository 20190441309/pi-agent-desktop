import { ipcMain } from "electron";
import type { CodexSessionImporter } from "../services/codex-session/importer";
import { codexScanSchema, codexImportSchema } from "./schemas";

export function setupCodexSessionsIpc(importer: CodexSessionImporter): void {
    ipcMain.handle("codex-sessions:scan", async (_event, workspacePath: string) => {
        codexScanSchema.parse([workspacePath]);
        return importer.scan(workspacePath);
    });
    ipcMain.handle("codex-sessions:import", async (_event, workspacePath: string, sourcePaths: string[]) => {
        codexImportSchema.parse([workspacePath, sourcePaths]);
        return importer.import(workspacePath, sourcePaths);
    });
}

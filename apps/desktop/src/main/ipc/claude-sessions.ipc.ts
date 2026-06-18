import { ipcMain } from "electron";
import type { ClaudeSessionImporter } from "../services/claude-session/importer";
import { claudeScanSchema, claudeImportSchema } from "./schemas";

export function setupClaudeSessionsIpc(importer: ClaudeSessionImporter): void {
    ipcMain.handle("claude-sessions:scan", async (_event, workspacePath: string) => {
        claudeScanSchema.parse([workspacePath]);
        return importer.scan(workspacePath);
    });
    ipcMain.handle("claude-sessions:import", async (_event, workspacePath: string, sourcePaths: string[]) => {
        claudeImportSchema.parse([workspacePath, sourcePaths]);
        return importer.import(workspacePath, sourcePaths);
    });
}
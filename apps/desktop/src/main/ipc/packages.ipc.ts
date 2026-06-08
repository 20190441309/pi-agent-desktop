import { ipcMain } from "electron";
import log from "electron-log/main";
import { ipcError } from "@shared";
import {
    fetchPackageCatalog,
    installPackage,
    listInstalledPackages,
    removePackage,
    searchPackages,
    updatePackage,
} from "../services/pi-packages/pi-package-adapter";
import { packageSearchSchema, packageSourceSchema } from "./schemas";

export function setupPackagesIpc(): void {
    ipcMain.handle("packages:search", async (_event, query: string) => {
        const parsed = packageSearchSchema.safeParse([query]);
        if (!parsed.success) {
            return ipcError("ipcErrors.packages.searchInvalid", "搜索插件参数无效");
        }
        try {
            return await searchPackages(query);
        } catch (err) {
            log.error("[packages.ipc] search failed:", err);
            return ipcError(
                "ipcErrors.packages.searchFailed",
                `搜索 Pi 插件失败: ${err instanceof Error ? err.message : String(err)}`,
                { query },
            );
        }
    });

    ipcMain.handle("packages:refresh-catalog", async () => {
        try {
            return await fetchPackageCatalog();
        } catch (err) {
            log.error("[packages.ipc] refresh catalog failed:", err);
            return ipcError(
                "ipcErrors.packages.refreshFailed",
                `刷新 Pi 插件市场失败: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    });

    ipcMain.handle("packages:list-installed", async () => {
        try {
            return await listInstalledPackages();
        } catch (err) {
            log.error("[packages.ipc] list installed failed:", err);
            return ipcError(
                "ipcErrors.packages.listFailed",
                `列出 Pi 插件失败: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    });

    ipcMain.handle("packages:install", async (_event, source: string) => {
        const parsed = packageSourceSchema.safeParse([source]);
        if (!parsed.success) {
            return ipcError("ipcErrors.packages.installInvalid", "安装插件参数无效");
        }
        try {
            return await installPackage(source);
        } catch (err) {
            log.error("[packages.ipc] install failed:", err);
            return ipcError(
                "ipcErrors.packages.installFailed",
                `安装 Pi 插件失败: ${err instanceof Error ? err.message : String(err)}`,
                { source },
            );
        }
    });

    ipcMain.handle("packages:remove", async (_event, source: string) => {
        const parsed = packageSourceSchema.safeParse([source]);
        if (!parsed.success) {
            return ipcError("ipcErrors.packages.removeInvalid", "卸载插件参数无效");
        }
        try {
            return await removePackage(source);
        } catch (err) {
            log.error("[packages.ipc] remove failed:", err);
            return ipcError(
                "ipcErrors.packages.removeFailed",
                `卸载 Pi 插件失败: ${err instanceof Error ? err.message : String(err)}`,
                { source },
            );
        }
    });

    ipcMain.handle("packages:update", async (_event, source: string) => {
        const parsed = packageSourceSchema.safeParse([source]);
        if (!parsed.success) {
            return ipcError("ipcErrors.packages.updateInvalid", "更新插件参数无效");
        }
        try {
            return await updatePackage(source);
        } catch (err) {
            log.error("[packages.ipc] update failed:", err);
            return ipcError(
                "ipcErrors.packages.updateFailed",
                `更新 Pi 插件失败: ${err instanceof Error ? err.message : String(err)}`,
                { source },
            );
        }
    });
}

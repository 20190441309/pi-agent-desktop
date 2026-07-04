// Plan IPC Handler (Task 4.3)
// 暴露 6 个 plan 文件 CRUD 通道给渲染层,委托 PlanFileService 落盘:
//   - plan:create   → PlanFileService.create(workspacePath, input)
//   - plan:list     → PlanFileService.list(workspacePath, options)
//   - plan:get      → PlanFileService.read(workspacePath, filename)
//   - plan:update   → PlanFileService.update(workspacePath, filename, input)
//   - plan:complete → PlanFileService.complete(workspacePath, filename)
//   - plan:delete   → PlanFileService.delete(workspacePath, filename)
//
// 错误处理 (与 chat.ipc / git.ipc 风格一致):
//   - workspace 未找到 → ipcError("ipcErrors.plan.workspaceNotFound", ..., { id })
//   - Zod 校验失败     → ipcError("ipcErrors.plan.invalidInput", ...)
//   - PlanFileService 抛 → ipcError("ipcErrors.plan.<op>Failed", ...)
//   - plan:get 不存在   → 返回 null (与 PlanFileService.read 行为对齐)
//
// 不抛异常,所有错误都返回 IpcError 形状由渲染层 isIpcError() 识别.

import { ipcMain } from "electron";
import log from "electron-log/main";
import type { ZodError } from "zod";
import { ipcError, type IpcError, type PlanRecord } from "@shared";
import { PlanFileService } from "../services/plan/plan-file-service";
import {
    PlanCreateSchema,
    PlanFilenameSchema,
    PlanListOptionsSchema,
    PlanUpdateSchema,
} from "./schemas";

interface WorkspaceLite {
    id: string;
    name: string;
    path: string;
}

export interface PlanIpcDeps {
    /** PlanFileService 实例 (主进程单例, 由 main/index.ts 注入). */
    planFileService: PlanFileService;
    /** 同步拿 workspace path. 与 chat.ipc 的 getWorkspace 同款,返回 undefined 表示未找到. */
    getWorkspace: (id: string) => WorkspaceLite | undefined;
}

function invalidInput(err: ZodError | Error): IpcError {
    return ipcError(
        "ipcErrors.plan.invalidInput",
        `plan 入参无效: ${err instanceof Error ? err.message : String(err)}`,
    );
}

export function setupPlanIpc(deps: PlanIpcDeps): void {
    // ── plan:create ───────────────────────────────────────────────
    ipcMain.handle("plan:create", async (_event, input: unknown) => {
        let parsed: {
            workspaceId: string;
            slug: string;
            title: string;
            content: string;
        };
        try {
            parsed = PlanCreateSchema.parse(input);
        } catch (err) {
            log.warn("[plan.ipc] plan:create invalid input:", err);
            return invalidInput(err as ZodError);
        }
        const ws = deps.getWorkspace(parsed.workspaceId);
        if (!ws) {
            return ipcError(
                "ipcErrors.plan.workspaceNotFound",
                `Workspace 未找到: ${parsed.workspaceId}`,
                { id: parsed.workspaceId },
            );
        }
        try {
            return deps.planFileService.create(ws.path, {
                slug: parsed.slug,
                title: parsed.title,
                content: parsed.content,
            });
        } catch (err) {
            log.error("[plan.ipc] plan:create failed:", err);
            return ipcError(
                "ipcErrors.plan.createFailed",
                `创建 plan 失败: ${err instanceof Error ? err.message : String(err)}`,
                { workspace: ws.name },
            );
        }
    });

    // ── plan:list ─────────────────────────────────────────────────
    ipcMain.handle("plan:list", async (_event, input: unknown) => {
        let parsed: {
            workspaceId: string;
            includeCompleted?: boolean;
            includeCancelled?: boolean;
        };
        try {
            parsed = PlanListOptionsSchema.parse(input ?? {});
        } catch (err) {
            log.warn("[plan.ipc] plan:list invalid input:", err);
            return invalidInput(err as ZodError);
        }
        const ws = deps.getWorkspace(parsed.workspaceId);
        if (!ws) {
            return ipcError(
                "ipcErrors.plan.workspaceNotFound",
                `Workspace 未找到: ${parsed.workspaceId}`,
                { id: parsed.workspaceId },
            );
        }
        try {
            return deps.planFileService.list(ws.path, {
                includeCompleted: parsed.includeCompleted,
                includeCancelled: parsed.includeCancelled,
            });
        } catch (err) {
            log.error("[plan.ipc] plan:list failed:", err);
            return ipcError(
                "ipcErrors.plan.listFailed",
                `列出 plan 失败: ${err instanceof Error ? err.message : String(err)}`,
                { workspace: ws.name },
            );
        }
    });

    // ── plan:get ──────────────────────────────────────────────────
    ipcMain.handle("plan:get", async (_event, input: unknown) => {
        let parsed: { workspaceId: string; filename: string };
        try {
            parsed = PlanFilenameSchema.parse(input);
        } catch (err) {
            log.warn("[plan.ipc] plan:get invalid input:", err);
            return invalidInput(err as ZodError);
        }
        const ws = deps.getWorkspace(parsed.workspaceId);
        if (!ws) {
            return ipcError(
                "ipcErrors.plan.workspaceNotFound",
                `Workspace 未找到: ${parsed.workspaceId}`,
                { id: parsed.workspaceId },
            );
        }
        try {
            // read 返回 null 表示文件不存在 — 透传给渲染层 (null 是合法值,非错误).
            return deps.planFileService.read(ws.path, parsed.filename) as PlanRecord | null;
        } catch (err) {
            log.error("[plan.ipc] plan:get failed:", err);
            return ipcError(
                "ipcErrors.plan.getFailed",
                `读取 plan 失败: ${err instanceof Error ? err.message : String(err)}`,
                { workspace: ws.name, filename: parsed.filename },
            );
        }
    });

    // ── plan:update ───────────────────────────────────────────────
    ipcMain.handle("plan:update", async (_event, input: unknown) => {
        let parsed: {
            workspaceId: string;
            filename: string;
            content?: string;
            status?: "draft" | "executing" | "completed" | "cancelled";
            title?: string;
        };
        try {
            parsed = PlanUpdateSchema.parse(input);
        } catch (err) {
            log.warn("[plan.ipc] plan:update invalid input:", err);
            return invalidInput(err as ZodError);
        }
        const ws = deps.getWorkspace(parsed.workspaceId);
        if (!ws) {
            return ipcError(
                "ipcErrors.plan.workspaceNotFound",
                `Workspace 未找到: ${parsed.workspaceId}`,
                { id: parsed.workspaceId },
            );
        }
        try {
            return deps.planFileService.update(ws.path, parsed.filename, {
                content: parsed.content,
                status: parsed.status,
                title: parsed.title,
            });
        } catch (err) {
            log.error("[plan.ipc] plan:update failed:", err);
            return ipcError(
                "ipcErrors.plan.updateFailed",
                `更新 plan 失败: ${err instanceof Error ? err.message : String(err)}`,
                { workspace: ws.name, filename: parsed.filename },
            );
        }
    });

    // ── plan:complete ─────────────────────────────────────────────
    ipcMain.handle("plan:complete", async (_event, input: unknown) => {
        let parsed: { workspaceId: string; filename: string };
        try {
            parsed = PlanFilenameSchema.parse(input);
        } catch (err) {
            log.warn("[plan.ipc] plan:complete invalid input:", err);
            return invalidInput(err as ZodError);
        }
        const ws = deps.getWorkspace(parsed.workspaceId);
        if (!ws) {
            return ipcError(
                "ipcErrors.plan.workspaceNotFound",
                `Workspace 未找到: ${parsed.workspaceId}`,
                { id: parsed.workspaceId },
            );
        }
        try {
            return deps.planFileService.complete(ws.path, parsed.filename);
        } catch (err) {
            log.error("[plan.ipc] plan:complete failed:", err);
            return ipcError(
                "ipcErrors.plan.completeFailed",
                `完成 plan 失败: ${err instanceof Error ? err.message : String(err)}`,
                { workspace: ws.name, filename: parsed.filename },
            );
        }
    });

    // ── plan:delete ───────────────────────────────────────────────
    ipcMain.handle("plan:delete", async (_event, input: unknown) => {
        let parsed: { workspaceId: string; filename: string };
        try {
            parsed = PlanFilenameSchema.parse(input);
        } catch (err) {
            log.warn("[plan.ipc] plan:delete invalid input:", err);
            return invalidInput(err as ZodError);
        }
        const ws = deps.getWorkspace(parsed.workspaceId);
        if (!ws) {
            return ipcError(
                "ipcErrors.plan.workspaceNotFound",
                `Workspace 未找到: ${parsed.workspaceId}`,
                { id: parsed.workspaceId },
            );
        }
        try {
            deps.planFileService.delete(ws.path, parsed.filename);
            return undefined;
        } catch (err) {
            log.error("[plan.ipc] plan:delete failed:", err);
            return ipcError(
                "ipcErrors.plan.deleteFailed",
                `删除 plan 失败: ${err instanceof Error ? err.message : String(err)}`,
                { workspace: ws.name, filename: parsed.filename },
            );
        }
    });
}

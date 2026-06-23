// WorkspaceRegistry
// Multi-workspace orchestration: workspaceId -> AgentSession mapping
// get() reuses sessions; lazy-inits bridge + interceptor + subscriptions on first call
// Event types use @shared/events PiEvent (no 'as any')

import { createWorkspaceSession, type WorkspaceSession } from "./factory";
import { createEventBridge, type IpcSender } from "./event-bridge";
import { createApprovalInterceptor } from "../approval/interceptor";
import { createExtensionUiBridge } from "../extensions/extension-ui-bridge";
import type { AgentMode } from "@shared";
import type { PiEvent } from "@shared/events";
import type { PendingEdits } from "../approval/pending-edits";
import log from "electron-log/main";

/** 内部存储: session + 已初始化的 bridge/interceptor/subscription */
interface WorkspaceEntry {
    session: WorkspaceSession;
    subscribed: boolean;
}

export class WorkspaceRegistry {
    private entries = new Map<string, WorkspaceEntry>();
    // in-flight 创建 promise: 防止并发首次调用创建重复 session (TOCTOU)
    private creating = new Map<string, Promise<WorkspaceEntry>>();

    async get(
        workspaceId: string,
        workspacePath: string,
        pendingEdits?: PendingEdits,
        send?: IpcSender,
        getMode?: () => AgentMode,
    ): Promise<WorkspaceSession> {
        const existing = this.entries.get(workspaceId);
        if (existing) return existing.session;

        // 复用进行中的创建 promise, 保证每个 workspaceId 只创建一次
        let creating = this.creating.get(workspaceId);
        if (!creating) {
            creating = (async () => {
                const session = await createWorkspaceSession({
                    workspaceId,
                    workspacePath,
                    uiContext: createExtensionUiBridge(workspaceId),
                });
                const entry: WorkspaceEntry = { session, subscribed: false };
                this.entries.set(workspaceId, entry);
                return entry;
            })();
            this.creating.set(workspaceId, creating);
            // 无论成功失败, 都清理 in-flight 标记 (成功后 entries 已持有)
            void creating.finally(() => this.creating.delete(workspaceId));
        }
        const entry = await creating;

        if (send && pendingEdits && !entry.subscribed) {
            this.ensureSubscribed(entry, workspaceId, workspacePath, pendingEdits, send, getMode);
        }

        return entry.session;
    }

    has(workspaceId: string): boolean {
        return this.entries.has(workspaceId);
    }

    private ensureSubscribed(
        entry: WorkspaceEntry,
        workspaceId: string,
        workspacePath: string,
        pendingEdits: PendingEdits,
        send: IpcSender,
        getMode?: () => AgentMode,
    ): void {
        if (entry.subscribed) return;
        const bridge = createEventBridge(workspaceId, send);
        const interceptor = createApprovalInterceptor(workspaceId, {
            abort: () => entry.session.session.abort(),
            pendingEdits,
            send,
            workspacePath,
            getMode,
        });
        // 卡死看门狗: agent_start 起计时, agent_end/turn_end/extension_error 清除.
        // 超时仍未收到结束事件 → 视为 session 崩溃, 合成 extension_error 通知 renderer 翻转状态.
        let watchdog: NodeJS.Timeout | null = null;
        const WATCHDOG_MS = 5 * 60 * 1000; // 5 分钟无结束事件即判定卡死
        const armWatchdog = () => {
            if (watchdog) return;
            watchdog = setTimeout(() => {
                watchdog = null;
                log.error("[WorkspaceRegistry] session watchdog fired (stuck running):", workspaceId);
                const stuckEvent = {
                    type: "extension_error",
                    message: "会话运行超时未结束，可能已崩溃。请重新发起对话。",
                    workspaceId,
                };
                try {
                    bridge.handleEvent(stuckEvent as unknown as PiEvent);
                } catch (err) {
                    log.error("[chat.ipc] watchdog bridge error:", err);
                }
            }, WATCHDOG_MS);
        };
        const disarmWatchdog = () => {
            if (watchdog) {
                clearTimeout(watchdog);
                watchdog = null;
            }
        };
        // 订阅事件: 先过 interceptor (决策), 再过 bridge (推 renderer)
        // 外部包 @earendil-works/pi-coding-agent 的 subscribe 签名是 (cb: (event: unknown) => void)
        // 这里把它当 PiEvent 用 (类型安全)
        entry.session.session.subscribe(async (rawEvent) => {
            const event = rawEvent as unknown as PiEvent;
            try {
                await interceptor.handleEvent(event);
            } catch (err) {
                log.error("[chat.ipc] interceptor error:", err);
            }
            try {
                bridge.handleEvent(event);
            } catch (err) {
                log.error("[chat.ipc] event-bridge error:", err);
            }
            // 看门狗联动
            if (event?.type === "agent_start" || event?.type === "message_start") {
                armWatchdog();
            } else if (
                event?.type === "agent_end" ||
                event?.type === "turn_end" ||
                event?.type === "extension_error"
            ) {
                disarmWatchdog();
            }
        });
        entry.subscribed = true;
        // dispose 时清理看门狗, 避免泄漏 + 避免对已销毁 session 触发假卡死
        const origDispose = entry.session.dispose.bind(entry.session);
        entry.session.dispose = () => {
            disarmWatchdog();
            origDispose();
        };
    }

    dispose(workspaceId: string): void {
        const entry = this.entries.get(workspaceId);
        if (entry) {
            try {
                entry.session.dispose();
            } catch (err) {
                log.warn("[WorkspaceRegistry] dispose error for", workspaceId, err);
            }
            this.entries.delete(workspaceId);
        }
    }

    disposeAll(): void {
        for (const [id, entry] of this.entries) {
            try {
                entry.session.dispose();
            } catch (err) {
                log.warn("[WorkspaceRegistry] dispose error for", id, err);
            }
        }
        this.entries.clear();
    }

    size(): number {
        return this.entries.size;
    }
}

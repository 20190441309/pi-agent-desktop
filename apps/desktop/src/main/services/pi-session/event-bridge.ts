// EventBridge (M1 Task 8)
// 转换 Pi 原生事件 → renderer 友好的简化事件
// Pi 事件文档: node_modules/@earendil-works/pi-coding-agent/docs/rpc.md

import log from "electron-log/main";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { PiEvent, PiEventType } from "@shared/events";

type MissingSdkEventTypes = Exclude<AgentSessionEvent["type"], PiEventType>;
const SDK_EVENT_TYPES_ARE_COVERED: MissingSdkEventTypes extends never ? true : never = true;
void SDK_EVENT_TYPES_ARE_COVERED;

export type IpcSender = (channel: string, workspaceId: string, payload: unknown) => void;

export interface EventBridgeDeps {
    /**
     * Optional stop-gate hook invoked AFTER the `turn_end` Pi event is
     * forwarded to the renderer. Used by `GoalService.onTurnEnd` to run the
     * judge model on the active goal. The bridge only knows the
     * `workspaceId` (Pi's `turn_end` event carries no agent/message ids),
     * so `agentId` / `lastAssistantMessageId` are left to the GoalService
     * to resolve (defaults to the workspace's main agent).
     */
    onTurnEnd?: (workspaceId: string) => void;
}

export function normalizeCustomMessageEvent(event: PiEvent): PiEvent {
    if (event.type !== "message_end") return event;
    const message = (event as { message?: unknown }).message;
    if (!message || typeof message !== "object") return event;
    const customMessage = message as {
        role?: unknown;
        customType?: unknown;
        content?: unknown;
        display?: unknown;
        details?: unknown;
    };
    if (customMessage.role !== "custom") return event;
    return {
        type: "custom_message",
        customType: typeof customMessage.customType === "string" ? customMessage.customType : "",
        content: typeof customMessage.content === "string" ? customMessage.content : "",
        display: typeof customMessage.display === "boolean" ? customMessage.display : true,
        details: customMessage.details,
    };
}

export function createEventBridge(workspaceId: string, send: IpcSender, deps?: EventBridgeDeps) {
    return {
        handleEvent(event: PiEvent) {
            const forwardedEvent = normalizeCustomMessageEvent(event);
            switch (forwardedEvent.type) {
                case "turn_end":
                    // Forward to renderer first so the UI can flip streaming
                    // state immediately, then notify the GoalService stop-gate.
                    send("pi:event", workspaceId, forwardedEvent);
                    deps?.onTurnEnd?.(workspaceId);
                    break;

                case "agent_start":
                case "turn_start":
                case "message_start":
                case "message_update":
                case "message_end":
                case "tool_execution_start":
                case "tool_execution_update":
                case "tool_execution_end":
                case "agent_end":
                case "compaction_start":
                case "compaction_end":
                case "auto_retry_start":
                case "auto_retry_end":
                case "session_info_changed":
                case "thinking_level_changed":
                case "usage_update":
                case "context_update":
                case "custom_message":
                case "queue_update":
                case "extension_error":
                    send("pi:event", workspaceId, forwardedEvent);
                    break;

                default:
                    {
                        const exhaustiveEvent: never = forwardedEvent;
                        log.warn(`[event-bridge] unknown Pi event type: ${(exhaustiveEvent as { type?: string })?.type ?? "(unknown)"}`);
                    }
                    break;
            }
        },
    };
}

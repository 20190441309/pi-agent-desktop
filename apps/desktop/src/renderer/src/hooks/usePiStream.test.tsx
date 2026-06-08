// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PiEvent } from "@shared/events";
import { usePiStream } from "./usePiStream";
import { useSessionStore } from "../stores/session-store";

let emitPiEvent: ((event: PiEvent) => void) | null = null;
const sendPrompt = vi.fn(async () => undefined);
const stopPrompt = vi.fn<(_workspaceId: string) => Promise<unknown>>(async () => undefined);

function HookHost(): null {
    usePiStream();
    return null;
}

function HookStateHost() {
    const state = usePiStream();
    return (
        <div>
            <div data-testid="stream-error">{state.error ?? ""}</div>
            <button type="button" onClick={() => void state.startStreaming("ws1", "follow up")}>
                send-follow-up
            </button>
            <button type="button" onClick={() => state.stopStreaming("ws1")}>
                stop
            </button>
        </div>
    );
}

beforeEach(() => {
    emitPiEvent = null;
    sendPrompt.mockClear();
    stopPrompt.mockReset();
    stopPrompt.mockResolvedValue(undefined);
    (globalThis as { window: unknown }).window = {
        dispatchEvent: vi.fn(),
        // 2026-06-06 hotfix (T6): usePiStream 用 setTimeout/setInterval 防 debounce 卡住,
        // 测试 mock window 历来不包含定时器,补上
        setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
        clearTimeout: (id: number) => clearTimeout(id),
        setInterval: (...args: Parameters<typeof setInterval>) => setInterval(...args),
        clearInterval: (id: number) => clearInterval(id),
        piAPI: {
            getStatus: vi.fn(async () => ({
                installed: true,
                localVersion: "0.0.0",
                latestVersion: "0.0.0",
                updateAvailable: false,
                executablePath: "pi",
                installMethod: "test",
                configExists: true,
                defaultProvider: "test",
                defaultModel: "test",
            })),
            onEvent: vi.fn((cb: (event: PiEvent) => void) => {
                emitPiEvent = cb;
                return vi.fn();
            }),
            sendPrompt,
            stop: stopPrompt,
        },
    };
    useSessionStore.setState({
        currentSessionId: "s1",
        sessions: [
            {
                id: "s1",
                title: "Session",
                workspaceId: "ws1",
                createdAt: new Date(0),
                updatedAt: new Date(0),
                messages: [],
            },
        ],
    });
});

describe("usePiStream", () => {
    it("handles SDK message_update events emitted immediately after subscription", async () => {
        await act(async () => {
            render(<HookHost />);
        });
        expect(emitPiEvent).toBeTruthy();

        await act(async () => {
            emitPiEvent?.({ type: "agent_start" });
            emitPiEvent?.({ type: "message_start" });
            emitPiEvent?.({
                type: "message_update",
                assistantMessageEvent: {
                    type: "text_delta",
                    delta: "你好",
                },
            });
        });

        const session = useSessionStore.getState().sessions[0];
        expect(session.messages).toHaveLength(1);
        expect(session.messages[0]).toMatchObject({
            role: "assistant",
            content: "你好",
        });
    });

    it("still handles legacy flattened message_update events", async () => {
        await act(async () => {
            render(<HookHost />);
        });

        await act(async () => {
            emitPiEvent?.({ type: "agent_start" });
            emitPiEvent?.({ type: "message_start" });
            emitPiEvent?.({
                type: "message_update",
                subtype: "text_delta",
                delta: "legacy",
            });
        });

        const session = useSessionStore.getState().sessions[0];
        expect(session.messages[0]).toMatchObject({
            role: "assistant",
            content: "legacy",
        });
    });

    it("syncs SDK tool calls into the assistant message without a second assistant row", async () => {
        await act(async () => {
            render(<HookHost />);
        });

        await act(async () => {
            emitPiEvent?.({ type: "agent_start" });
            emitPiEvent?.({
                type: "message_update",
                assistantMessageEvent: {
                    type: "toolcall_start",
                    toolCallId: "tc_1",
                    toolName: "read",
                    args: { path: "README.md" },
                },
            });
            emitPiEvent?.({
                type: "message_update",
                assistantMessageEvent: {
                    type: "text_delta",
                    delta: "读完了",
                },
            });
            emitPiEvent?.({
                type: "message_update",
                assistantMessageEvent: {
                    type: "toolcall_end",
                    toolCallId: "tc_1",
                    result: "ok",
                },
            });
        });

        const session = useSessionStore.getState().sessions[0];
        expect(session.messages).toHaveLength(1);
        expect(session.messages[0]).toMatchObject({
            role: "assistant",
            content: "读完了",
        });
        expect(session.messages[0].toolCalls).toHaveLength(1);
        expect(session.messages[0].toolCalls?.[0]).toMatchObject({
            id: "tc_1",
            name: "read",
            input: { path: "README.md" },
            output: "ok",
            status: "completed",
        });
    });

    it("syncs execution-only tool events into the assistant message", async () => {
        await act(async () => {
            render(<HookHost />);
        });

        await act(async () => {
            emitPiEvent?.({ type: "agent_start" });
            emitPiEvent?.({
                type: "tool_execution_start",
                toolCallId: "tc_exec",
                toolName: "bash",
                args: { command: "pwd" },
            });
            emitPiEvent?.({
                type: "tool_execution_end",
                toolCallId: "tc_exec",
                toolName: "bash",
                isError: false,
            });
        });

        const session = useSessionStore.getState().sessions[0];
        expect(session.messages).toHaveLength(1);
        expect(session.messages[0].toolCalls).toHaveLength(1);
        expect(session.messages[0].toolCalls?.[0]).toMatchObject({
            id: "tc_exec",
            name: "bash",
            input: { command: "pwd" },
            status: "completed",
        });
    });

    it("surfaces empty Pi turns as a visible error", async () => {
        await act(async () => {
            render(<HookStateHost />);
        });

        await act(async () => {
            emitPiEvent?.({ type: "agent_start" });
            emitPiEvent?.({ type: "agent_end" });
        });

        expect(screen.getByTestId("stream-error").textContent).toContain("Pi 本轮没有返回内容");
    });

    it("surfaces extension errors with details and ends streaming", async () => {
        await act(async () => {
            render(<HookStateHost />);
        });

        await act(async () => {
            emitPiEvent?.({ type: "agent_start" });
            emitPiEvent?.({ type: "extension_error", message: "扩展无法读取 package.json" } as PiEvent);
        });

        expect(screen.getByTestId("stream-error").textContent).toContain("扩展无法读取 package.json");
        expect((window.dispatchEvent as ReturnType<typeof vi.fn>).mock.calls.some((call) => {
            const event = call[0] as Event;
            return event.type === "pi:stream-end";
        })).toBe(true);
    });

    it("shows stop IPC fallback instead of silently swallowing it", async () => {
        stopPrompt.mockResolvedValueOnce({
            __error: true,
            code: "PI_STOP_FAILED",
            fallback: "停止失败: agent is not running",
        });
        await act(async () => {
            render(<HookStateHost />);
        });

        await act(async () => {
            screen.getByText("stop").click();
        });

        expect(stopPrompt).toHaveBeenCalledWith("ws1");
        expect(screen.getByTestId("stream-error").textContent).toContain("停止失败: agent is not running");
    });

    it("shows rejected stop errors instead of silently swallowing them", async () => {
        stopPrompt.mockRejectedValueOnce(new Error("transport closed"));
        await act(async () => {
            render(<HookStateHost />);
        });

        await act(async () => {
            screen.getByText("stop").click();
        });

        expect(screen.getByTestId("stream-error").textContent).toContain("停止失败: transport closed");
    });

    it("sends follow-up while streaming without resetting the active assistant message", async () => {
        await act(async () => {
            render(<HookStateHost />);
        });

        await act(async () => {
            emitPiEvent?.({ type: "agent_start" });
            emitPiEvent?.({
                type: "message_update",
                assistantMessageEvent: {
                    type: "text_delta",
                    delta: "partial",
                },
            });
        });

        await act(async () => {
            screen.getByText("send-follow-up").click();
        });

        await act(async () => {
            emitPiEvent?.({
                type: "message_update",
                assistantMessageEvent: {
                    type: "text_delta",
                    delta: " answer",
                },
            });
        });

        const session = useSessionStore.getState().sessions[0];
        expect(sendPrompt).toHaveBeenCalledWith("ws1", "follow up");
        expect(session.messages).toHaveLength(2);
        expect(session.messages[0]).toMatchObject({ role: "assistant", content: "partial answer" });
        expect(session.messages[1]).toMatchObject({ role: "user", content: "follow up" });
        expect((window.dispatchEvent as ReturnType<typeof vi.fn>).mock.calls.filter((call) => {
            const event = call[0] as Event;
            return event.type === "pi:stream-start";
        })).toHaveLength(0);
    });
});

// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PiEvent } from "@shared/events";
import { usePiStream } from "./usePiStream";
import { useSessionStore } from "../stores/session-store";

let emitPiEvent: ((event: PiEvent) => void) | null = null;

function HookHost(): null {
    usePiStream();
    return null;
}

function HookStateHost() {
    const state = usePiStream();
    return <div data-testid="stream-error">{state.error ?? ""}</div>;
}

beforeEach(() => {
    emitPiEvent = null;
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
});

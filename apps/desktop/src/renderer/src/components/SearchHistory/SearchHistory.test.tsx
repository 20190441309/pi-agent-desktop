// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchHistory } from "./SearchHistory";
import { useSessionStore } from "../../stores/session-store";
import { useWorkspaceStore } from "../../stores/workspace-store";

describe("SearchHistory", () => {
    beforeEach(() => {
        Object.defineProperty(window, "piAPI", {
            value: undefined,
            configurable: true,
        });

        useWorkspaceStore.setState({
            workspaces: [
                {
                    id: "ws1",
                    name: "repo",
                    path: "C:/repo",
                    createdAt: new Date(0),
                    lastActiveAt: new Date(0),
                },
                {
                    id: "ws2",
                    name: "other-repo",
                    path: "C:/other",
                    createdAt: new Date(0),
                    lastActiveAt: new Date(0),
                },
            ],
            currentWorkspaceId: "ws1",
            loaded: true,
            lastError: null,
        });

        useSessionStore.setState({
            sessions: [
                {
                    id: "active-session",
                    title: "Active Session",
                    workspaceId: "ws1",
                    createdAt: new Date(0),
                    updatedAt: new Date(0),
                    archived: false,
                    messages: [
                        {
                            id: "msg-active",
                            role: "user",
                            content: "alpha visible result",
                            timestamp: new Date(0),
                        },
                    ],
                },
                {
                    id: "archived-session",
                    title: "Archived Session",
                    workspaceId: "ws2",
                    createdAt: new Date(0),
                    updatedAt: new Date(0),
                    archived: true,
                    messages: [
                        {
                            id: "msg-archived",
                            role: "assistant",
                            content: "omega archived only",
                            timestamp: new Date(0),
                        },
                    ],
                },
            ],
            currentSessionId: null,
            sessionsLoading: false,
            persistErrorCount: 0,
            lastPersistError: null,
        } as Partial<ReturnType<typeof useSessionStore.getState>>);
    });

    it("includes archived workspace sessions in history search results", () => {
        const onNavigate = vi.fn();
        render(<SearchHistory isOpen onClose={vi.fn()} onNavigate={onNavigate} />);

        fireEvent.change(screen.getByRole("textbox", { name: "搜索对话历史" }), {
            target: { value: "omega" },
        });

        expect(screen.getByRole("button", { name: /Archived Session/ })).toBeTruthy();
        expect(screen.getByText("other-repo")).toBeTruthy();
    });
});

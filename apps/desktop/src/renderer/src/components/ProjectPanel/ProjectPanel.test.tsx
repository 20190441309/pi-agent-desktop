// ProjectPanel 测试 — 可用度 sessions 任务
// 覆盖: 对话列表的 rename 按钮 / 确认弹窗 / 键盘 (Enter / Esc / F2)
//
// 关键 fixture:
//   - 当前 workspace 已设置 (否则显示 CTA, 没有 session list)
//   - 至少一个 session 已存在于 store
//   - piAPI mock 包含 listWorkspaces / listSkills / listPlugins / detectProject

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ProjectPanel } from "./ProjectPanel";
import { I18nProvider } from "../../i18n";
import { useWorkspaceStore } from "../../stores/workspace-store";
import { useSessionStore } from "../../stores/session-store";
import { usePluginStore } from "../../stores/plugin-store";

// FileTreeView 是独立组件, 它的 IPC / 文件系统依赖太重, 直接 mock 掉
vi.mock("../FileTree", () => ({
    FileTreeView: () => <div data-testid="file-tree-stub" />,
}));

function makePiAPI() {
    return {
        listWorkspaces: vi.fn(async () => []),
        listSessions: vi.fn(async () => []),
        listSkills: vi.fn(async () => []),
        listPlugins: vi.fn(async () => []),
        detectProject: vi.fn(async () => null),
        createSession: vi.fn(async () => undefined),
        renameSession: vi.fn(async () => undefined),
        deleteSession: vi.fn(async () => undefined),
    };
}

function renderWithI18n(ui: React.ReactElement) {
    return render(<I18nProvider>{ui}</I18nProvider>);
}

beforeEach(() => {
    // 强制 zh-CN 让中文断言稳定
    window.localStorage.setItem("pi-desktop.locale", "zh-CN");
    const piAPI = makePiAPI();
    (window as unknown as { piAPI: unknown }).piAPI = piAPI;

    // 设置当前 workspace, 否则 ProjectPanel 显示 CTA 而非 session list
    useWorkspaceStore.setState({
        workspaces: [
            {
                id: "ws-1",
                name: "demo",
                path: "/tmp/demo",
                createdAt: new Date(0),
                lastActiveAt: new Date(0),
            },
        ],
        currentWorkspaceId: "ws-1",
    });

    // 注入一个 session
    useSessionStore.setState({
        sessions: [
            {
                id: "s1",
                title: "first session",
                workspaceId: "ws-1",
                createdAt: new Date(0),
                updatedAt: new Date(0),
                messages: [],
            },
            {
                id: "s2",
                title: "second session",
                workspaceId: "ws-1",
                createdAt: new Date(0),
                updatedAt: new Date(0),
                messages: [],
            },
        ],
        currentSessionId: "s1",
    });

    // plugin store 默认空 + 不 loading
    usePluginStore.setState({
        skills: [],
        plugins: [],
        isLoading: false,
        error: null,
    });
});

describe("ProjectPanel — session rename UI", () => {
    it("渲染重命名 + 删除按钮 (aria-label 包含 session title)", () => {
        renderWithI18n(<ProjectPanel activePanel="chat" />);
        expect(screen.getByLabelText("重命名: first session")).toBeTruthy();
        expect(screen.getByLabelText("删除: first session")).toBeTruthy();
        expect(screen.getByLabelText("重命名: second session")).toBeTruthy();
        expect(screen.getByLabelText("删除: second session")).toBeTruthy();
    });

    it("点重命名按钮 → 行变 input, 旧 title 被预填, focus 落在 input", async () => {
        renderWithI18n(<ProjectPanel activePanel="chat" />);
        const renameBtn = screen.getByLabelText("重命名: first session");
        fireEvent.click(renameBtn);
        const input = screen.getByLabelText("重命名对话") as HTMLInputElement;
        expect(input.value).toBe("first session");
        // 异步 focus → 等一帧
        await waitFor(() => {
            expect(document.activeElement).toBe(input);
        });
    });

    it("input 里按 Enter → store 收到 rename, UI 退回到行", () => {
        renderWithI18n(<ProjectPanel activePanel="chat" />);
        fireEvent.click(screen.getByLabelText("重命名: first session"));
        const input = screen.getByLabelText("重命名对话") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "renamed!" } });
        fireEvent.keyDown(input, { key: "Enter" });

        const s = useSessionStore.getState().sessions.find((x) => x.id === "s1")!;
        expect(s.title).toBe("renamed!");
        // input 消失, 按钮回来
        expect(screen.queryByLabelText("重命名对话")).toBeNull();
        expect(screen.getByLabelText("重命名: renamed!")).toBeTruthy();
    });

    it("input 里按 Esc → 不改名, 退回到行", () => {
        renderWithI18n(<ProjectPanel activePanel="chat" />);
        fireEvent.click(screen.getByLabelText("重命名: first session"));
        const input = screen.getByLabelText("重命名对话") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "nope" } });
        fireEvent.keyDown(input, { key: "Escape" });

        const s = useSessionStore.getState().sessions.find((x) => x.id === "s1")!;
        expect(s.title).toBe("first session");
        expect(screen.queryByLabelText("重命名对话")).toBeNull();
    });

    it("空 input 按 Enter → 当作取消, title 不变", () => {
        renderWithI18n(<ProjectPanel activePanel="chat" />);
        fireEvent.click(screen.getByLabelText("重命名: first session"));
        const input = screen.getByLabelText("重命名对话") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "   " } });
        fireEvent.keyDown(input, { key: "Enter" });

        const s = useSessionStore.getState().sessions.find((x) => x.id === "s1")!;
        expect(s.title).toBe("first session");
    });

    it("F2 键 → 直接进入 edit 模式 (无 click 触发)", () => {
        renderWithI18n(<ProjectPanel activePanel="chat" />);
        const row = screen.getByLabelText("重命名: first session").closest('[role="button"]') as HTMLElement;
        expect(row).toBeTruthy();
        fireEvent.keyDown(row, { key: "F2" });
        expect(screen.getByLabelText("重命名对话")).toBeTruthy();
    });
});

describe("ProjectPanel — session delete UI", () => {
    it("点删除 → 弹确认 dialog, role=dialog + aria-modal=true", () => {
        renderWithI18n(<ProjectPanel activePanel="chat" />);
        fireEvent.click(screen.getByLabelText("删除: first session"));
        const dialog = screen.getByRole("dialog");
        expect(dialog.getAttribute("aria-modal")).toBe("true");
        // dialog 里要包含被删的 title
        expect(dialog.textContent).toContain("first session");
        // 标题
        expect(within(dialog).getByText("删除对话")).toBeTruthy();
    });

    it("点确认删除 → session 没了, dialog 关掉", async () => {
        renderWithI18n(<ProjectPanel activePanel="chat" />);
        fireEvent.click(screen.getByLabelText("删除: first session"));
        const dialog = screen.getByRole("dialog");
        // dialog 里有两个 button: 取消 + 删除
        const buttons = within(dialog).getAllByRole("button");
        const confirmBtn = buttons.find((b) => b.textContent === "删除")!;
        expect(confirmBtn).toBeTruthy();
        fireEvent.click(confirmBtn);

        // 等 state 更新 + dialog 卸载
        await waitFor(() => {
            expect(screen.queryByRole("dialog")).toBeNull();
        });
        const sessions = useSessionStore.getState().sessions;
        expect(sessions.find((s) => s.id === "s1")).toBeUndefined();
        expect(sessions).toHaveLength(1);
    });

    it("点取消 → session 还在, dialog 关掉", async () => {
        renderWithI18n(<ProjectPanel activePanel="chat" />);
        fireEvent.click(screen.getByLabelText("删除: first session"));
        const dialog = screen.getByRole("dialog");
        const buttons = within(dialog).getAllByRole("button");
        const cancelBtn = buttons.find((b) => b.textContent === "取消")!;
        fireEvent.click(cancelBtn);

        await waitFor(() => {
            expect(screen.queryByRole("dialog")).toBeNull();
        });
        const sessions = useSessionStore.getState().sessions;
        expect(sessions.find((s) => s.id === "s1")).toBeDefined();
    });

    it("Esc 关掉 dialog, session 还在", () => {
        renderWithI18n(<ProjectPanel activePanel="chat" />);
        fireEvent.click(screen.getByLabelText("删除: first session"));
        expect(screen.getByRole("dialog")).toBeTruthy();
        fireEvent.keyDown(window, { key: "Escape" });
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(useSessionStore.getState().sessions.find((s) => s.id === "s1")).toBeDefined();
    });
});

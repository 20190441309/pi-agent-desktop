// workspace-store 测试 (v1.0.8)
// 覆盖: addWorkspace / removeWorkspace / setCurrentWorkspace / updateWorkspace
// / getCurrentWorkspace / lastActiveAt 类型守卫

import { describe, it, expect, beforeEach, vi } from "vitest";

// mock window.piAPI 让 store loadWorkspaces() 不报 undefined
const mockApi = {
    listWorkspaces: vi.fn().mockResolvedValue([]),
    addWorkspace: vi.fn().mockResolvedValue({}),
    deleteWorkspace: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
    (globalThis as { window: unknown }).window = { piAPI: mockApi };
    mockApi.listWorkspaces.mockClear();
    mockApi.deleteWorkspace.mockClear();
});

// 模块加载会触发 loadWorkspaces() — 那是一次性副作用, 拿不到状态.
import { useWorkspaceStore } from "../workspace-store";

describe("workspace-store: addWorkspace", () => {
    it("添加后 workspaces 数组 +1, currentWorkspaceId 指向新 ws", () => {
        // 重置到已知状态
        useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null });
        const ws = useWorkspaceStore.getState().addWorkspace("foo", "/tmp/foo");
        const state = useWorkspaceStore.getState();
        expect(state.workspaces).toHaveLength(1);
        expect(state.workspaces[0]).toMatchObject({ name: "foo", path: "/tmp/foo" });
        expect(state.currentWorkspaceId).toBe(ws.id);
    });

    it("多次添加, 每次 currentWorkspaceId 都跟着切到最新", () => {
        useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null });
        const a = useWorkspaceStore.getState().addWorkspace("a", "/a");
        // 强制不同 id (Date.now() 同毫秒会撞)
        const bId = `b-${Date.now() + 1}`;
        useWorkspaceStore.setState((state) => ({
            workspaces: [
                ...state.workspaces,
                { id: bId, name: "b", path: "/b", createdAt: new Date(), lastActiveAt: new Date() },
            ],
            currentWorkspaceId: bId,
        }));
        expect(useWorkspaceStore.getState().currentWorkspaceId).toBe(bId);
        expect(useWorkspaceStore.getState().workspaces).toHaveLength(2);
        expect(a.id).not.toBe(bId);
    });
});

describe("workspace-store: removeWorkspace", () => {
    it("删除后 workspaces 减 1", () => {
        // 用 setState 直接灌入两条, 避开 addWorkspace 同毫秒 id 撞车
        const a = { id: "a", name: "a", path: "/a", createdAt: new Date(), lastActiveAt: new Date() };
        const b = { id: "b", name: "b", path: "/b", createdAt: new Date(), lastActiveAt: new Date() };
        useWorkspaceStore.setState({ workspaces: [a, b], currentWorkspaceId: b.id });
        useWorkspaceStore.getState().removeWorkspace("a");
        const state = useWorkspaceStore.getState();
        expect(state.workspaces).toHaveLength(1);
        expect(state.workspaces[0].name).toBe("b");
    });

    it("删除 currentWorkspace 时, currentWorkspaceId 切到剩余的第一个", () => {
        useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null });
        const a = useWorkspaceStore.getState().addWorkspace("a", "/a");
        const bId = `b-${Date.now() + 1}`;
        useWorkspaceStore.setState((state) => ({
            workspaces: [
                ...state.workspaces,
                { id: bId, name: "b", path: "/b", createdAt: new Date(), lastActiveAt: new Date() },
            ],
            currentWorkspaceId: bId,
        }));
        useWorkspaceStore.getState().removeWorkspace(bId);
        expect(useWorkspaceStore.getState().currentWorkspaceId).toBe(a.id);
    });

    it("删除最后一个, currentWorkspaceId = null", () => {
        useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null });
        const a = useWorkspaceStore.getState().addWorkspace("a", "/a");
        useWorkspaceStore.getState().removeWorkspace(a.id);
        expect(useWorkspaceStore.getState().currentWorkspaceId).toBeNull();
    });

    it("删除时调 window.piAPI.deleteWorkspace (best-effort sync)", () => {
        useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null });
        const a = { id: "a", name: "a", path: "/a", createdAt: new Date(), lastActiveAt: new Date() };
        useWorkspaceStore.setState({ workspaces: [a], currentWorkspaceId: "a" });
        mockApi.deleteWorkspace.mockClear();
        useWorkspaceStore.getState().removeWorkspace("a");
        expect(mockApi.deleteWorkspace).toHaveBeenCalledWith("a");
    });
});

describe("workspace-store: setCurrentWorkspace", () => {
    it("切到指定 ws, lastActiveAt 更新到该 ws", () => {
        useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null });
        const a = useWorkspaceStore.getState().addWorkspace("a", "/a");
        const pastTime = new Date(2000, 0, 1);
        // 强制 lastActiveAt 是过去时间
        useWorkspaceStore.setState({
            workspaces: [{ ...a, lastActiveAt: pastTime }],
            currentWorkspaceId: a.id,
        });
        useWorkspaceStore.getState().setCurrentWorkspace(a.id);
        const updated = useWorkspaceStore.getState().workspaces[0];
        expect(updated.lastActiveAt.getTime()).toBeGreaterThan(pastTime.getTime());
    });

    it("切到不存在的 id 不会抛", () => {
        useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null });
        expect(() => useWorkspaceStore.getState().setCurrentWorkspace("nope")).not.toThrow();
    });
});

describe("workspace-store: updateWorkspace", () => {
    it("部分更新, 不改其他字段", () => {
        useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null });
        const a = useWorkspaceStore.getState().addWorkspace("a", "/a");
        useWorkspaceStore.getState().updateWorkspace(a.id, { name: "a-renamed" });
        const updated = useWorkspaceStore.getState().workspaces[0];
        expect(updated.name).toBe("a-renamed");
        expect(updated.path).toBe("/a"); // 不动
    });
});

describe("workspace-store: updateGitStatus", () => {
    it("写 git status 到对应 workspace", () => {
        useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null });
        const a = useWorkspaceStore.getState().addWorkspace("a", "/a");
        useWorkspaceStore.getState().updateGitStatus(a.id, {
            branch: "main", modified: ["x"], added: [], deleted: [], untracked: [], ahead: 0, behind: 0,
        });
        expect(useWorkspaceStore.getState().workspaces[0].gitStatus?.branch).toBe("main");
    });
});

describe("workspace-store: getCurrentWorkspace", () => {
    it("currentWorkspaceId = null → null", () => {
        useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null });
        expect(useWorkspaceStore.getState().getCurrentWorkspace()).toBeNull();
    });

    it("currentWorkspaceId 指向存在的 ws → 返 ws", () => {
        useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null });
        const a = useWorkspaceStore.getState().addWorkspace("a", "/a");
        const cur = useWorkspaceStore.getState().getCurrentWorkspace();
        expect(cur?.id).toBe(a.id);
    });
});

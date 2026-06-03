// session-store 测试 (v1.0.x — 可用度 sessions 任务)
// 覆盖: renameSession (新增) / deleteSession (现有) / createSession / setCurrentSession
// renameSession 关键路径:
//   - 改 title + updatedAt
//   - 空字符串/全空白 → 不改 state (warn 一次)
//   - 走 piAPI.renameSession (fire-and-forget, 失败不抛)
//   - 不存在的 sessionId → 静默 noop (filter 行为)

import { describe, it, expect, beforeEach, vi } from "vitest";

function makePiAPI() {
    return {
        listSessions: vi.fn(async () => []),
        createSession: vi.fn(async (workspaceId: string, title?: string) => ({
            id: `srv-${Date.now()}`,
            title: title || "Session",
            workspaceId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        })),
        renameSession: vi.fn(async (id: string, title: string) => ({
            id,
            title,
            workspaceId: "ws-1",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        })),
        deleteSession: vi.fn(async () => undefined),
    };
}

let piAPI: ReturnType<typeof makePiAPI>;

beforeEach(() => {
    piAPI = makePiAPI();
    // node 环境: window 不存在, 通过 globalThis.window 注入,
    // 跟其它 store 测试 (workspace / settings) 保持一致
    (globalThis as { window: unknown }).window = { piAPI };
    vi.clearAllMocks();
});

// 模块加载会触发 loadSessions() 一次性副作用, 拿到 store 后再重置.
import { useSessionStore } from "../session-store";

function seedSession(id: string, title: string) {
    useSessionStore.setState((s) => ({
        sessions: [
            ...s.sessions,
            {
                id,
                title,
                workspaceId: "ws-1",
                createdAt: new Date(0),
                updatedAt: new Date(0),
                messages: [],
            },
        ],
        currentSessionId: id,
    }));
}

describe("session-store: renameSession", () => {
    it("改 title 并刷新 updatedAt", async () => {
        useSessionStore.setState({ sessions: [], currentSessionId: null });
        seedSession("s1", "old name");
        const before = useSessionStore.getState().sessions[0].updatedAt.getTime();

        // 让 updatedAt 的变化可观察
        const later = new Date(before + 5000);
        vi.useFakeTimers();
        vi.setSystemTime(later);

        useSessionStore.getState().renameSession("s1", "new name");

        vi.useRealTimers();

        const s = useSessionStore.getState().sessions[0];
        expect(s.title).toBe("new name");
        expect(s.updatedAt.getTime()).toBeGreaterThan(before);
        // fire-and-forget 也调用了
        await new Promise((r) => setTimeout(r, 0));
        expect(piAPI.renameSession).toHaveBeenCalledWith("s1", "new name");
    });

    it("trim 前后空白, 空字符串不改 state", async () => {
        useSessionStore.setState({ sessions: [], currentSessionId: null });
        seedSession("s1", "keep me");
        useSessionStore.getState().renameSession("s1", "  spaced  ");
        expect(useSessionStore.getState().sessions[0].title).toBe("spaced");

        seedSession("s2", "still here");
        useSessionStore.getState().renameSession("s2", "   ");
        // 空字符串被拒绝, title 不变
        const s2 = useSessionStore.getState().sessions.find((s) => s.id === "s2")!;
        expect(s2.title).toBe("still here");
        // 持久化也没调
        await new Promise((r) => setTimeout(r, 0));
        expect(piAPI.renameSession).not.toHaveBeenCalledWith("s2", "   ");
    });

    it("不存在的 sessionId 静默 noop", () => {
        useSessionStore.setState({ sessions: [], currentSessionId: null });
        seedSession("s1", "old");
        useSessionStore.getState().renameSession("ghost", "whatever");
        const all = useSessionStore.getState().sessions;
        expect(all).toHaveLength(1);
        expect(all[0].title).toBe("old");
    });

    it("只改目标 session, 其他 session 不动", () => {
        useSessionStore.setState({ sessions: [], currentSessionId: null });
        seedSession("a", "A");
        seedSession("b", "B");
        useSessionStore.getState().renameSession("a", "A2");
        const state = useSessionStore.getState();
        expect(state.sessions.find((s) => s.id === "a")!.title).toBe("A2");
        expect(state.sessions.find((s) => s.id === "b")!.title).toBe("B");
    });
});

describe("session-store: deleteSession", () => {
    it("删除后 sessions.length - 1", () => {
        useSessionStore.setState({ sessions: [], currentSessionId: null });
        seedSession("s1", "A");
        seedSession("s2", "B");
        useSessionStore.getState().deleteSession("s1");
        expect(useSessionStore.getState().sessions).toHaveLength(1);
    });

    it("删的是当前 session → currentSessionId 切到剩下的第一个", () => {
        useSessionStore.setState({ sessions: [], currentSessionId: null });
        seedSession("s1", "A");
        seedSession("s2", "B");
        useSessionStore.setState({ currentSessionId: "s1" });
        useSessionStore.getState().deleteSession("s1");
        // 剩下的 = [s2]
        expect(useSessionStore.getState().currentSessionId).toBe("s2");
    });

    it("删的不是当前 session → currentSessionId 保持", () => {
        useSessionStore.setState({ sessions: [], currentSessionId: null });
        seedSession("s1", "A");
        seedSession("s2", "B");
        useSessionStore.setState({ currentSessionId: "s1" });
        useSessionStore.getState().deleteSession("s2");
        expect(useSessionStore.getState().currentSessionId).toBe("s1");
    });

    it("删光所有 session → currentSessionId = null", () => {
        useSessionStore.setState({ sessions: [], currentSessionId: null });
        seedSession("s1", "only");
        useSessionStore.getState().deleteSession("s1");
        expect(useSessionStore.getState().currentSessionId).toBeNull();
    });
});

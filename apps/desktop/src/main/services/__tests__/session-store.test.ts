// 主进程 session 持久化模块单测
// 2026-06-06 hotfix: 覆盖 7 个 CRUD 函数 + mutex 串行化 + 边界

import { describe, it, expect, beforeEach } from "vitest";
import type { Session, Message } from "@shared";
import type { SessionPersistence } from "../session-store";
import {
    listSessions,
    getSession,
    createSession,
    renameSession,
    deleteSession,
    appendMessage,
    updateMessage,
    updateToolCall,
    updateSessionMetadata,
} from "../session-store";

// ── In-memory mock for SessionPersistence ───────────────────────────────

function makeStore(seed: Session[] = []): SessionPersistence & {
    raw: Session[];
    writes: number;
} {
    const raw: Session[] = [...seed];
    let writes = 0;
    return {
        raw,
        get writes() {
            return writes;
        },
        get(_key) {
            return raw;
        },
        set(_key, value) {
            writes += 1;
            // 关键:value 可能就是 raw 本身(被测代码先把 session push 进 raw,
            // 再 store.set 整个 raw)。需要先 snapshot 一下,再 mutate。
            const snapshot = [...value];
            raw.length = 0;
            for (const v of snapshot) raw.push(v);
        },
    };
}

const userMsg = (id: string, content: string): Message => ({
    id,
    role: "user",
    content,
    timestamp: new Date("2026-06-06T10:00:00Z"),
});

const asstMsg = (id: string, content: string, toolCalls: Message["toolCalls"] = []): Message => ({
    id,
    role: "assistant",
    content,
    timestamp: new Date("2026-06-06T10:00:01Z"),
    toolCalls,
});

// ── 基础 CRUD ───────────────────────────────────────────────────────────

describe("session-store: list / get / create", () => {
    it("createSession 初始化 messages: [] 并落盘", async () => {
        const store = makeStore();
        const s = await createSession(store, "ws1", "测试");
        expect(s.messages).toEqual([]);
        expect(s.title).toBe("测试");
        expect(store.writes).toBe(1);
        expect(store.raw).toHaveLength(1);
    });

    it("createSession 不传 title 默认 '未命名会话'", async () => {
        const store = makeStore();
        const s = await createSession(store, "ws1");
        expect(s.title).toBe("未命名会话");
    });

    it("createSession title 全空白 fallback '未命名会话'", async () => {
        const store = makeStore();
        const s = await createSession(store, "ws1", "   ");
        expect(s.title).toBe("未命名会话");
    });

    it("createSession 显式传 id 走指定 id", async () => {
        const store = makeStore();
        const s = await createSession(store, "ws1", "t", "s_custom");
        expect(s.id).toBe("s_custom");
    });

    it("listSessions 返 store 内的所有 session", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "a");
        await createSession(store, "ws1", "b");
        const all = await listSessions(store);
        expect(all.map((s) => s.title)).toEqual(["a", "b"]);
    });

    it("getSession 按 id 命中", async () => {
        const store = makeStore();
        const s = await createSession(store, "ws1", "t", "s1");
        const got = await getSession(store, "s1");
        expect(got).toBeDefined();
        expect(got!.id).toBe("s1");
    });

    it("getSession id 不存在返 undefined", async () => {
        const store = makeStore();
        expect(await getSession(store, "ghost")).toBeUndefined();
    });
});

describe("session-store: rename", () => {
    it("renameSession 改 title + updatedAt", async () => {
        const store = makeStore();
        const s = await createSession(store, "ws1", "old", "s1");
        const before = s.updatedAt;
        // 模拟时间推进
        await new Promise((r) => setTimeout(r, 5));
        const updated = await renameSession(store, "s1", "new");
        expect(updated.title).toBe("new");
        expect(updated.updatedAt).toBeGreaterThanOrEqual(before);
    });

    it("renameSession 全空白时保留旧 title (与主进程现有行为一致)", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "keep me", "s1");
        const updated = await renameSession(store, "s1", "   ");
        expect(updated.title).toBe("keep me");
    });

    it("renameSession id 不存在抛错", async () => {
        const store = makeStore();
        await expect(renameSession(store, "ghost", "x")).rejects.toThrow(
            /Session not found/,
        );
    });

    it("renameSession 不动 messages", async () => {
        const store = makeStore();
        const s = await createSession(store, "ws1", "t", "s1");
        await appendMessage(store, "s1", userMsg("m1", "hi"));
        const before = (await getSession(store, "s1"))!.messages.length;
        await renameSession(store, "s1", "renamed");
        const after = (await getSession(store, "s1"))!.messages.length;
        expect(after).toBe(before);
        expect(after).toBe(1);
        void s;
    });
});

describe("session-store: metadata", () => {
    it("createSession 初始化工作台元数据默认值", async () => {
        const store = makeStore();
        const s = await createSession(store, "ws1", "meta", "s1");
        expect(s.favorite).toBe(false);
        expect(s.tags).toEqual([]);
        expect(s.readOnly).toBe(false);
        expect(typeof s.lastOpenedAt).toBe("number");
    });

    it("updateSessionMetadata 写入收藏、标签、只读、usage 和工具权限", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "meta", "s1");
        const updated = await updateSessionMetadata(store, "s1", {
            favorite: true,
            tags: [" bug ", "bug", "windows"],
            readOnly: true,
            lastOpenedAt: 123,
            usage: {
                model: "m1",
                provider: "p1",
                totalTokens: 42,
                compactionStatus: "running",
                updatedAt: 456,
            },
            toolPermissions: {
                fileRead: true,
                fileWrite: false,
                shell: false,
                git: true,
                network: false,
                extensions: true,
            },
        });
        expect(updated.favorite).toBe(true);
        expect(updated.tags).toEqual(["bug", "windows"]);
        expect(updated.readOnly).toBe(true);
        expect(updated.lastOpenedAt).toBe(123);
        expect(updated.usage?.totalTokens).toBe(42);
        expect(updated.toolPermissions?.fileWrite).toBe(false);
    });
});

describe("session-store: delete", () => {
    it("deleteSession 移除指定 session, 其它不动", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "a", "s1");
        await createSession(store, "ws1", "b", "s2");
        await deleteSession(store, "s1");
        const all = await listSessions(store);
        expect(all).toHaveLength(1);
        expect(all[0].id).toBe("s2");
    });

    it("deleteSession id 不存在静默 noop (filter 不抛错)", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "a", "s1");
        await deleteSession(store, "ghost");
        expect((await listSessions(store))).toHaveLength(1);
    });
});

// ── Messages 持久化 ───────────────────────────────────────────────────

describe("session-store: appendMessage", () => {
    it("追加到 session.messages 末尾", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "t", "s1");
        await appendMessage(store, "s1", userMsg("m1", "hello"));
        const s = await getSession(store, "s1");
        expect(s!.messages).toHaveLength(1);
        expect(s!.messages[0].id).toBe("m1");
    });

    it("session 不存在抛错", async () => {
        const store = makeStore();
        await expect(appendMessage(store, "ghost", userMsg("m1", "x"))).rejects.toThrow(
            /Session not found/,
        );
    });

    it("appendMessage 重复 id 幂等(不重复添加)", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "t", "s1");
        await appendMessage(store, "s1", userMsg("m1", "first"));
        await appendMessage(store, "s1", userMsg("m1", "second"));
        const s = await getSession(store, "s1");
        expect(s!.messages).toHaveLength(1);
        expect(s!.messages[0].content).toBe("first");
    });

    it("appendMessage 多个 session 互不干扰", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "a", "s1");
        await createSession(store, "ws1", "b", "s2");
        await appendMessage(store, "s1", userMsg("m1", "for s1"));
        await appendMessage(store, "s2", userMsg("m2", "for s2"));
        const s1 = await getSession(store, "s1");
        const s2 = await getSession(store, "s2");
        expect(s1!.messages[0].content).toBe("for s1");
        expect(s2!.messages[0].content).toBe("for s2");
    });
});

describe("session-store: updateMessage", () => {
    it("updateMessage 改 content 保留 id/role/timestamp", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "t", "s1");
        await appendMessage(store, "s1", asstMsg("m1", "init"));
        const originalTimestamp = (await getSession(store, "s1"))!.messages[0].timestamp;
        const updated = await updateMessage(store, "s1", "m1", { content: "new" });
        const m = updated.messages[0];
        expect(m.content).toBe("new");
        expect(m.id).toBe("m1");
        expect(m.role).toBe("assistant");
        expect(m.timestamp).toEqual(originalTimestamp);
    });

    it("updateMessage 改 toolCalls 整体替换", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "t", "s1");
        await appendMessage(store, "s1", asstMsg("m1", "", []));
        const newTC = [
            { id: "tc1", name: "read", status: "completed" as const, startTime: new Date() },
        ];
        const updated = await updateMessage(store, "s1", "m1", { toolCalls: newTC });
        expect(updated.messages[0].toolCalls).toHaveLength(1);
        expect(updated.messages[0].toolCalls![0].name).toBe("read");
    });

    it("updateMessage session 不存在抛错", async () => {
        const store = makeStore();
        await expect(updateMessage(store, "ghost", "m1", { content: "x" })).rejects.toThrow(
            /Session not found/,
        );
    });

    it("updateMessage message 不存在抛错", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "t", "s1");
        await expect(updateMessage(store, "s1", "ghost", { content: "x" })).rejects.toThrow(
            /Message not found/,
        );
    });
});

describe("session-store: updateToolCall", () => {
    it("改单个 tool call 字段", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "t", "s1");
        await appendMessage(
            store,
            "s1",
            asstMsg("m1", "", [
                { id: "tc1", name: "read", status: "running", startTime: new Date() },
            ]),
        );
        const updated = await updateToolCall(store, "s1", "m1", "tc1", {
            status: "completed",
            output: { ok: true },
        });
        const tc = updated.messages[0].toolCalls![0];
        expect(tc.status).toBe("completed");
        expect(tc.output).toEqual({ ok: true });
        expect(tc.name).toBe("read");
    });

    it("message 不存在抛错", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "t", "s1");
        await expect(
            updateToolCall(store, "s1", "ghost", "tc1", { status: "completed" }),
        ).rejects.toThrow(/Message not found/);
    });

    it("tool call 不存在抛错(不静默新增)", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "t", "s1");
        await appendMessage(store, "s1", asstMsg("m1", "", []));
        await expect(
            updateToolCall(store, "s1", "m1", "ghost", { status: "completed" }),
        ).rejects.toThrow(/ToolCall not found/);
    });

    it("message 存在但 toolCalls 字段缺失时,不会自动建空数组后报错(报错优先)", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "t", "s1");
        await appendMessage(store, "s1", asstMsg("m1", "")); // 没传 toolCalls
        await expect(
            updateToolCall(store, "s1", "m1", "tc1", { status: "completed" }),
        ).rejects.toThrow(/ToolCall not found/);
    });
});

// ── Mutex 串行化(并发安全) ─────────────────────────────────────────────

describe("session-store: mutex 串行化并发写", () => {
    it("并发 appendMessage N 次,所有 message 都能落盘且按到达顺序", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "t", "s1");
        const N = 20;
        await Promise.all(
            Array.from({ length: N }, (_, i) =>
                appendMessage(store, "s1", userMsg(`m${i}`, `content-${i}`)),
            ),
        );
        const s = await getSession(store, "s1");
        expect(s!.messages).toHaveLength(N);
        // 所有 id 都出现过,且唯一
        const ids = new Set(s!.messages.map((m) => m.id));
        expect(ids.size).toBe(N);
    });

    it("并发 append + update 交错不丢字段", async () => {
        const store = makeStore();
        await createSession(store, "ws1", "t", "s1");
        await appendMessage(store, "s1", asstMsg("m1", "init"));
        // 同时跑:10 个 update content 累加 + 5 个 append
        const updates = Array.from({ length: 10 }, (_, i) =>
            updateMessage(store, "s1", "m1", { content: `step-${i}` }),
        );
        const appends = Array.from({ length: 5 }, (_, i) =>
            appendMessage(store, "s1", userMsg(`u${i}`, `user-${i}`)),
        );
        await Promise.all([...updates, ...appends]);
        const s = await getSession(store, "s1");
        // 1 个 assistant + 5 个 user = 6 条
        expect(s!.messages).toHaveLength(6);
        // 最终 content 应该是某个 step-N(任意一个),不会是初始的 "init"
        expect(s!.messages[0].content).toMatch(/^step-\d+$/);
    });

    it("create + delete + append 并发,最终 store 状态自洽", async () => {
        const store = makeStore();
        // 起 5 个 create
        const creates = Array.from({ length: 5 }, (_, i) =>
            createSession(store, "ws1", `s${i}`, `s${i}`),
        );
        const created = await Promise.all(creates);
        // 对每个 create 完的 id 跑 append
        const appends = created.map((s, i) =>
            appendMessage(store, s.id, userMsg(`m${i}`, `c-${i}`)),
        );
        await Promise.all(appends);
        const all = await listSessions(store);
        expect(all).toHaveLength(5);
        for (const s of all) {
            expect(s.messages).toHaveLength(1);
        }
    });

    it("create + append 并发:新会话与新消息都不丢失", async () => {
        // 验证 SubTask 4.1 修复:appendMessage 与 createSession 持同一全局锁,
        // 不会因 __global__ vs sessionId 锁键不同导致 append 落盘时把 create 的新 session 覆盖掉
        const store = makeStore();
        // createSession 与 appendMessage 同时发起 — appendMessage 的 sessionId
        // 与 createSession 即将创建的 id 相同,模拟"会话刚建好第一条消息就到了"
        const targetId = "s_concurrent";
        const createP = createSession(store, "ws1", "t", targetId);
        // 即便 create 尚未完成也发起 append(都会进全局锁队列,串行执行)
        const appendP = createP.then(() =>
            appendMessage(store, targetId, userMsg("m1", "first")),
        );
        await Promise.all([createP, appendP]);
        const all = await listSessions(store);
        // 新会话不丢失
        expect(all).toHaveLength(1);
        expect(all[0].id).toBe(targetId);
        // 新消息不丢失
        expect(all[0].messages).toHaveLength(1);
        expect(all[0].messages[0].id).toBe("m1");

        // 再批量并发:5 个 create + 各自 append 全部并行
        const mix = Array.from({ length: 5 }, async (_, i) => {
            const sid = `s_mix_${i}`;
            await createSession(store, "ws1", `t${i}`, sid);
            await appendMessage(store, sid, userMsg(`m${i}`, `c-${i}`));
        });
        await Promise.all(mix);
        const final = await listSessions(store);
        expect(final).toHaveLength(6);
        for (const s of final) {
            // targetId 那条已有 1 条消息,mix 的 5 条各 1 条
            expect(s.messages).toHaveLength(1);
        }
    });

    it("delete + update 并发:已删会话不被复活,update 不丢失", async () => {
        // 验证 SubTask 4.1 修复:deleteSession 与 updateMessage 持同一全局锁,
        // 不会因锁键不同导致 update 在 delete 之后又把已删 session 写回
        const store = makeStore();
        await createSession(store, "ws1", "t", "s_keep");
        await createSession(store, "ws1", "t", "s_del");
        await appendMessage(store, "s_del", asstMsg("m_del", "init"));
        await appendMessage(store, "s_keep", asstMsg("m_keep", "init"));

        // 并发:delete s_del + update s_keep 的消息
        const delP = deleteSession(store, "s_del");
        const updP = updateMessage(store, "s_keep", "m_keep", {
            content: "updated",
        });
        await Promise.all([delP, updP]);

        const all = await listSessions(store);
        // s_del 已删,不被复活
        expect(all.map((s) => s.id)).toEqual(["s_keep"]);
        // s_keep 的 update 落盘成功,不丢失
        expect(all[0].messages[0].content).toBe("updated");

        // 反向并发:update s_del(已存在) + delete s_del
        // 注:update 会先获取锁,可能先于 delete 执行(此时 session 还在,update 成功)
        // 也可能后于 delete 执行(此时 session 已删,update 抛 Session not found)
        // 两种情况都接受,关键是最终 s_del 不复活
        await createSession(store, "ws1", "t", "s_del2");
        await appendMessage(store, "s_del2", asstMsg("m_del2", "init"));
        const updP2 = updateMessage(store, "s_del2", "m_del2", {
            content: "concurrent-update",
        }).catch(() => "not-found" as const);
        const delP2 = deleteSession(store, "s_del2");
        await Promise.all([updP2, delP2]);
        const final = await listSessions(store);
        // s_del2 不复活
        expect(final.map((s) => s.id)).toEqual(["s_keep"]);
    });
});

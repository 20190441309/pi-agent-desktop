import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LongHorizonDatabase } from "../database";
import { TaskRegistry } from "../task-registry";

describe("Task integration (end-to-end)", () => {
    let dir: string;
    let db: LongHorizonDatabase;
    let registry: TaskRegistry;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "pi-task-int-"));
        db = new LongHorizonDatabase(dir);
        registry = new TaskRegistry(db);
    });

    afterEach(async () => {
        await db.close();
        rmSync(dir, { recursive: true, force: true });
    });

    it("walks through full lifecycle: create top-level + sub-task → start → block → unblock → done → verify events", async () => {
        // 1. 创建 top-level task T1
        const t1 = await registry.create({
            sessionId: "ws-1",
            summary: "Implement feature X",
        });
        expect(t1.id).toBe("T1");
        expect(t1.status).toBe("open");

        // 2. 创建 sub-task T1.1
        const t11 = await registry.create({
            sessionId: "ws-1",
            summary: "Write tests",
            parentId: "T1",
        });
        expect(t11.id).toBe("T1.1");
        expect(t11.parentTaskId).toBe("T1");

        // 3. 创建 sub-task T1.2
        const t12 = await registry.create({
            sessionId: "ws-1",
            summary: "Implement core logic",
            parentId: "T1",
        });
        expect(t12.id).toBe("T1.2");

        // 4. start T1
        const started = await registry.start({
            sessionId: "ws-1",
            id: "T1",
            eventSummary: "kicking off",
        });
        expect(started.status).toBe("in_progress");
        expect(started.owner).toBeUndefined(); // 未传 owner

        // 5. block T1
        const blocked = await registry.block({
            sessionId: "ws-1",
            id: "T1",
            eventSummary: "waiting on dependency",
        });
        expect(blocked.status).toBe("blocked");

        // 6. unblock T1
        const unblocked = await registry.unblock({
            sessionId: "ws-1",
            id: "T1",
            eventSummary: "dependency resolved",
        });
        expect(unblocked.status).toBe("in_progress");

        // 7. start T1.1 sub-task
        const subStarted = await registry.start({
            sessionId: "ws-1",
            id: "T1.1",
            owner: "agent-1",
        });
        expect(subStarted.owner).toBe("agent-1");

        // 8. done T1.1
        const subDone = await registry.done({
            sessionId: "ws-1",
            id: "T1.1",
            eventSummary: "tests written",
        });
        expect(subDone.status).toBe("done");
        expect(subDone.endedAt).toBeTypeOf("number");

        // 9. done T1 (parent)
        const done = await registry.done({
            sessionId: "ws-1",
            id: "T1",
            eventSummary: "feature complete",
        });
        expect(done.status).toBe("done");
        expect(done.endedAt).toBeTypeOf("number");

        // 10. list 默认（排除 terminal）
        const active = await registry.list({ sessionId: "ws-1" });
        // T1 (done), T1.1 (done) 排除；剩下 T1.2 (open)
        expect(active.map(t => t.id).sort()).toEqual(["T1.2"]);

        // 11. list includeTerminal
        const all = await registry.list({ sessionId: "ws-1", includeTerminal: true });
        expect(all.map(t => t.id).sort()).toEqual(["T1", "T1.1", "T1.2"]);

        // 12. 验证 task_event 流
        const rawDb = db.getDb();
        const events = rawDb.prepare(
            "SELECT task_id, kind, summary FROM task_event WHERE session_id = ? ORDER BY id ASC"
        ).all("ws-1") as Array<{ task_id: string; kind: string; summary: string | null }>;

        // 期望事件顺序（按发生顺序）：
        // T1 created
        // T1.1 created
        // T1.2 created
        // T1 started (kicking off)
        // T1 blocked (waiting on dependency)
        // T1 unblocked (dependency resolved)
        // T1.1 started
        // T1.1 done (tests written)
        // T1 done (feature complete)
        expect(events.map(e => `${e.task_id}:${e.kind}`)).toEqual([
            "T1:created",
            "T1.1:created",
            "T1.2:created",
            "T1:started",
            "T1:blocked",
            "T1:unblocked",
            "T1.1:started",
            "T1.1:done",
            "T1:done",
        ]);
    });

    it("supports rename and abandon flows with proper events", async () => {
        const t1 = await registry.create({ sessionId: "ws-2", summary: "old name" });
        await registry.start({ sessionId: "ws-2", id: "T1" });
        const renamed = await registry.rename({ sessionId: "ws-2", id: "T1", summary: "new name" });
        expect(renamed.summary).toBe("new name");
        const abandoned = await registry.abandon({ sessionId: "ws-2", id: "T1", eventSummary: "obsolete" });
        expect(abandoned.status).toBe("abandoned");

        const rawDb = db.getDb();
        const events = rawDb.prepare(
            "SELECT kind FROM task_event WHERE session_id = ? AND task_id = ? ORDER BY id ASC"
        ).all("ws-2", "T1") as Array<{ kind: string }>;
        expect(events.map(e => e.kind)).toEqual(["created", "started", "renamed", "abandoned"]);
    });

    it("rejects invalid state transitions and reports task not found", async () => {
        // Task not found
        await expect(
            registry.start({ sessionId: "ws-3", id: "T999" })
        ).rejects.toThrow(/not found/i);

        // Create + done, then try start (terminal state)
        const t = await registry.create({ sessionId: "ws-3", summary: "x" });
        await registry.done({ sessionId: "ws-3", id: t.id });
        await expect(
            registry.start({ sessionId: "ws-3", id: t.id })
        ).rejects.toThrow(/terminal state/i);

        // unblock on non-blocked
        const t2 = await registry.create({ sessionId: "ws-3", summary: "y" });
        await expect(
            registry.unblock({ sessionId: "ws-3", id: t2.id })
        ).rejects.toThrow(/not blocked/i);
    });

    it("isolates tasks by session_id (no cross-session leakage)", async () => {
        await registry.create({ sessionId: "ws-A", summary: "A1" });
        await registry.create({ sessionId: "ws-A", summary: "A2" });
        await registry.create({ sessionId: "ws-B", summary: "B1" });

        const a = await registry.list({ sessionId: "ws-A", includeTerminal: true });
        const b = await registry.list({ sessionId: "ws-B", includeTerminal: true });

        expect(a.map(t => t.id).sort()).toEqual(["T1", "T2"]);
        expect(b.map(t => t.id).sort()).toEqual(["T1"]);  // B session 独立分配 T1
    });
});

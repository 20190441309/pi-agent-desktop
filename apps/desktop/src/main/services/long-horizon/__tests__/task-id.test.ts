import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nextTaskId } from "../task-id";

describe("nextTaskId", () => {
    let db: DatabaseSync;
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "pi-task-id-"));
        db = new DatabaseSync(join(dir, "test.db"));
        db.exec("PRAGMA foreign_keys = ON;");
        db.exec(`
            CREATE TABLE task (
                id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                parent_task_id TEXT,
                status TEXT NOT NULL,
                summary TEXT NOT NULL,
                owner TEXT,
                created_at INTEGER NOT NULL,
                last_event_at INTEGER NOT NULL,
                ended_at INTEGER,
                cleanup_after INTEGER,
                source TEXT,
                workspace_id TEXT,
                agent_id TEXT,
                agent_key TEXT,
                ordinal INTEGER,
                PRIMARY KEY (session_id, id)
            );
        `);
    });

    afterEach(() => {
        db.close();
        rmSync(dir, { recursive: true, force: true });
    });

    function insertTask(id: string, parentId?: string): void {
        const now = Date.now();
        db.prepare(`
            INSERT INTO task (id, session_id, parent_task_id, status, summary, created_at, last_event_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, "session-1", parentId ?? null, "open", `task ${id}`, now, now);
    }

    it("returns T1 for top-level allocation on an empty table", () => {
        expect(nextTaskId(db, "session-1")).toBe("T1");
    });

    it("returns T6 when top-level tasks T1, T2, T5 exist (skips missing T3/T4)", () => {
        insertTask("T1");
        insertTask("T2");
        insertTask("T5");
        expect(nextTaskId(db, "session-1")).toBe("T6");
    });

    it("ignores sub-tasks (T1.1, T1.2) when allocating a top-level ID", () => {
        insertTask("T1.1", "T1");
        insertTask("T1.2", "T1");
        expect(nextTaskId(db, "session-1")).toBe("T1");
    });

    it("returns T1.1 when parent T1 has no children", () => {
        insertTask("T1");
        expect(nextTaskId(db, "session-1", "T1")).toBe("T1.1");
    });

    it("returns T1.4 when T1.1 and T1.3 exist as children of T1", () => {
        insertTask("T1");
        insertTask("T1.1", "T1");
        insertTask("T1.3", "T1");
        expect(nextTaskId(db, "session-1", "T1")).toBe("T1.4");
    });

    it("returns T1.1 when parent T1 exists with no children, even with other top-level tasks present", () => {
        insertTask("T1");
        insertTask("T2");
        insertTask("T3");
        expect(nextTaskId(db, "session-1", "T1")).toBe("T1.1");
    });

    it.each([
        ["t1"],     // lowercase 't' is rejected
        ["T"],      // missing digits
        ["T1."],    // trailing dot with no following digits
        ["T1.x"],   // non-digit segment
        [""],       // empty string
    ])("throws on invalid parentId format: %j", (parentId) => {
        expect(() => nextTaskId(db, "session-1", parentId)).toThrow(`Invalid task ID: ${parentId}`);
    });

    it("accepts deeply nested parentId T1.1.2.3.4 (valid format) and returns T1.1.2.3.4.1", () => {
        // Format /^T\d+(\.\d+)*$/ accepts arbitrarily deep nesting. Per the
        // algorithm spec, sub-task allocation appends a new segment, so the
        // first child of T1.1.2.3.4 is T1.1.2.3.4.1 (not T1.1.2.3.5, which
        // would be a sibling of T1.1.2.3.4).
        insertTask("T1.1.2.3.4");
        expect(nextTaskId(db, "session-1", "T1.1.2.3.4")).toBe("T1.1.2.3.4.1");
    });

    it("throws when parent task does not exist: T99", () => {
        expect(() => nextTaskId(db, "session-1", "T99")).toThrow("Parent task not found: T99");
    });

    it("allocates IDs correctly across a mixed top-level + sub-task flow", () => {
        // T1 (top-level)
        const t1 = nextTaskId(db, "session-1");
        expect(t1).toBe("T1");
        insertTask(t1);

        // T1.1 (sub-task of T1)
        const t1_1 = nextTaskId(db, "session-1", "T1");
        expect(t1_1).toBe("T1.1");
        insertTask(t1_1, "T1");

        // T1.2 (sub-task of T1)
        const t1_2 = nextTaskId(db, "session-1", "T1");
        expect(t1_2).toBe("T1.2");
        insertTask(t1_2, "T1");

        // T2 (top-level) — T1.1, T1.2 must not influence this allocation
        const t2 = nextTaskId(db, "session-1");
        expect(t2).toBe("T2");
        insertTask(t2);

        // T2.1 (sub-task of T2)
        const t2_1 = nextTaskId(db, "session-1", "T2");
        expect(t2_1).toBe("T2.1");
        insertTask(t2_1, "T2");
    });
});

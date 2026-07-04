import type { DatabaseSync } from "node:sqlite";
import type { LongHorizonDatabase } from "./database";
import { nextTaskId } from "./task-id";

export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "abandoned";

export type TaskEventKind =
    | "created"
    | "started"
    | "unstarted"
    | "blocked"
    | "unblocked"
    | "done"
    | "abandoned"
    | "renamed";

export interface TaskRecord {
    id: string;
    sessionId: string;
    parentTaskId?: string;
    status: TaskStatus;
    summary: string;
    owner?: string;
    createdAt: number;
    lastEventAt: number;
    endedAt?: number;
    cleanupAfter?: number;
}

export interface TaskCreateInput {
    sessionId: string;
    summary: string;
    parentId?: string;
    owner?: string;
}

export interface TaskListOptions {
    sessionId: string;
    status?: TaskStatus;
    includeTerminal?: boolean;
    includeArchived?: boolean;
}

export interface TaskStartOptions {
    sessionId: string;
    id: string;
    owner?: string;
    eventSummary?: string;
}

export interface TaskBlockOptions {
    sessionId: string;
    id: string;
    eventSummary?: string;
}

export interface TaskRenameInput {
    sessionId: string;
    id: string;
    summary: string;
}

const TERMINAL_STATUSES: ReadonlySet<TaskStatus> = new Set(["done", "abandoned"]);

function isTerminal(status: TaskStatus): boolean {
    return TERMINAL_STATUSES.has(status);
}

function rowToRecord(row: Record<string, unknown>): TaskRecord {
    const parentTaskId = row.parent_task_id;
    const owner = row.owner;
    const endedAt = row.ended_at;
    const cleanupAfter = row.cleanup_after;
    return {
        id: String(row.id),
        sessionId: String(row.session_id),
        parentTaskId:
            typeof parentTaskId === "string" && parentTaskId ? parentTaskId : undefined,
        status: String(row.status) as TaskStatus,
        summary: String(row.summary),
        owner: typeof owner === "string" && owner ? owner : undefined,
        createdAt: Number(row.created_at),
        lastEventAt: Number(row.last_event_at),
        endedAt: typeof endedAt === "number" ? endedAt : undefined,
        cleanupAfter: typeof cleanupAfter === "number" ? cleanupAfter : undefined,
    };
}

/**
 * TaskRegistry — Phase B Task 3 business logic layer.
 *
 * Owns all task state transitions and event sourcing for the `task` and
 * `task_event` tables. Every write is wrapped in a transaction; every state
 * transition is guarded by the per-method assertions on the current status.
 */
export class TaskRegistry {
    constructor(private readonly database: LongHorizonDatabase) {}

    async create(input: TaskCreateInput): Promise<TaskRecord> {
        await this.yieldToEventLoop();
        const db = this.database.getDb();
        db.exec("BEGIN");
        try {
            const id = nextTaskId(db, input.sessionId, input.parentId);
            const now = Date.now();
            db.prepare(`
                INSERT INTO task (
                    id, session_id, parent_task_id, status, summary, owner,
                    created_at, last_event_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id,
                input.sessionId,
                input.parentId ?? null,
                "open",
                input.summary,
                input.owner ?? null,
                now,
                now,
            );
            db.prepare(`
                INSERT INTO task_event (session_id, task_id, at, kind, summary)
                VALUES (?, ?, ?, ?, ?)
            `).run(input.sessionId, id, now, "created", input.summary);
            db.exec("COMMIT");
            const record = this.selectRecord(db, input.sessionId, id);
            if (!record) {
                throw new Error(`Task not found after insert: ${id}`);
            }
            return record;
        } catch (err) {
            try {
                db.exec("ROLLBACK");
            } catch {
                // Ignore rollback failure — original error is more important.
            }
            throw err;
        }
    }

    async list(options: TaskListOptions): Promise<TaskRecord[]> {
        await this.yieldToEventLoop();
        const db = this.database.getDb();
        const where: string[] = ["session_id = ?"];
        const params: Array<string | number | null> = [options.sessionId];
        if (options.status) {
            where.push("status = ?");
            params.push(options.status);
        }
        if (!options.includeTerminal) {
            where.push("status NOT IN ('done', 'abandoned')");
        }
        if (!options.includeArchived) {
            where.push("(cleanup_after IS NULL OR cleanup_after >= ?)");
            params.push(Date.now());
        }
        const sql = `SELECT * FROM task WHERE ${where.join(" AND ")} ORDER BY created_at ASC`;
        const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
        return rows.map(rowToRecord);
    }

    async get(sessionId: string, id: string): Promise<TaskRecord | null> {
        await this.yieldToEventLoop();
        const db = this.database.getDb();
        return this.selectRecord(db, sessionId, id);
    }

    async start(options: TaskStartOptions): Promise<TaskRecord> {
        await this.yieldToEventLoop();
        const db = this.database.getDb();
        db.exec("BEGIN");
        try {
            const current = this.requireRecord(db, options.sessionId, options.id);
            if (isTerminal(current.status)) {
                throw new Error(
                    `Task ${options.id} is in terminal state: ${current.status}`,
                );
            }
            if (current.status === "in_progress") {
                // Idempotent: no event inserted, no status change.
                if (options.owner !== undefined) {
                    const now = Date.now();
                    db.prepare(
                        "UPDATE task SET owner = ?, last_event_at = ? WHERE session_id = ? AND id = ?",
                    ).run(options.owner, now, options.sessionId, options.id);
                }
                db.exec("COMMIT");
                const refreshed = this.selectRecord(db, options.sessionId, options.id);
                if (!refreshed) {
                    throw new Error(`Task not found after update: ${options.id}`);
                }
                return refreshed;
            }
            const now = Date.now();
            db.prepare(
                "UPDATE task SET status = 'in_progress', owner = ?, last_event_at = ? WHERE session_id = ? AND id = ?",
            ).run(options.owner ?? current.owner ?? null, now, options.sessionId, options.id);
            db.prepare(`
                INSERT INTO task_event (session_id, task_id, at, kind, summary)
                VALUES (?, ?, ?, ?, ?)
            `).run(options.sessionId, options.id, now, "started", options.eventSummary ?? null);
            db.exec("COMMIT");
            const record = this.selectRecord(db, options.sessionId, options.id);
            if (!record) {
                throw new Error(`Task not found after update: ${options.id}`);
            }
            return record;
        } catch (err) {
            try {
                db.exec("ROLLBACK");
            } catch {
                // Ignore rollback failure — original error is more important.
            }
            throw err;
        }
    }

    async block(options: TaskBlockOptions): Promise<TaskRecord> {
        await this.yieldToEventLoop();
        const db = this.database.getDb();
        db.exec("BEGIN");
        try {
            const current = this.requireRecord(db, options.sessionId, options.id);
            if (isTerminal(current.status)) {
                throw new Error(
                    `Task ${options.id} is in terminal state: ${current.status}`,
                );
            }
            const now = Date.now();
            db.prepare(
                "UPDATE task SET status = 'blocked', last_event_at = ? WHERE session_id = ? AND id = ?",
            ).run(now, options.sessionId, options.id);
            db.prepare(`
                INSERT INTO task_event (session_id, task_id, at, kind, summary)
                VALUES (?, ?, ?, ?, ?)
            `).run(options.sessionId, options.id, now, "blocked", options.eventSummary ?? null);
            db.exec("COMMIT");
            const record = this.selectRecord(db, options.sessionId, options.id);
            if (!record) {
                throw new Error(`Task not found after update: ${options.id}`);
            }
            return record;
        } catch (err) {
            try {
                db.exec("ROLLBACK");
            } catch {
                // Ignore rollback failure — original error is more important.
            }
            throw err;
        }
    }

    async unblock(options: TaskBlockOptions): Promise<TaskRecord> {
        await this.yieldToEventLoop();
        const db = this.database.getDb();
        db.exec("BEGIN");
        try {
            const current = this.requireRecord(db, options.sessionId, options.id);
            if (current.status !== "blocked") {
                throw new Error(
                    `Task ${options.id} is not blocked (current: ${current.status})`,
                );
            }
            const now = Date.now();
            db.prepare(
                "UPDATE task SET status = 'in_progress', last_event_at = ? WHERE session_id = ? AND id = ?",
            ).run(now, options.sessionId, options.id);
            db.prepare(`
                INSERT INTO task_event (session_id, task_id, at, kind, summary)
                VALUES (?, ?, ?, ?, ?)
            `).run(options.sessionId, options.id, now, "unblocked", options.eventSummary ?? null);
            db.exec("COMMIT");
            const record = this.selectRecord(db, options.sessionId, options.id);
            if (!record) {
                throw new Error(`Task not found after update: ${options.id}`);
            }
            return record;
        } catch (err) {
            try {
                db.exec("ROLLBACK");
            } catch {
                // Ignore rollback failure — original error is more important.
            }
            throw err;
        }
    }

    async done(options: TaskBlockOptions): Promise<TaskRecord> {
        await this.yieldToEventLoop();
        const db = this.database.getDb();
        db.exec("BEGIN");
        try {
            const current = this.requireRecord(db, options.sessionId, options.id);
            if (isTerminal(current.status)) {
                throw new Error(
                    `Task ${options.id} is in terminal state: ${current.status}`,
                );
            }
            const now = Date.now();
            db.prepare(
                "UPDATE task SET status = 'done', last_event_at = ?, ended_at = ? WHERE session_id = ? AND id = ?",
            ).run(now, now, options.sessionId, options.id);
            db.prepare(`
                INSERT INTO task_event (session_id, task_id, at, kind, summary)
                VALUES (?, ?, ?, ?, ?)
            `).run(options.sessionId, options.id, now, "done", options.eventSummary ?? null);
            db.exec("COMMIT");
            const record = this.selectRecord(db, options.sessionId, options.id);
            if (!record) {
                throw new Error(`Task not found after update: ${options.id}`);
            }
            return record;
        } catch (err) {
            try {
                db.exec("ROLLBACK");
            } catch {
                // Ignore rollback failure — original error is more important.
            }
            throw err;
        }
    }

    async abandon(options: TaskBlockOptions): Promise<TaskRecord> {
        await this.yieldToEventLoop();
        const db = this.database.getDb();
        db.exec("BEGIN");
        try {
            const current = this.requireRecord(db, options.sessionId, options.id);
            if (isTerminal(current.status)) {
                throw new Error(
                    `Task ${options.id} is in terminal state: ${current.status}`,
                );
            }
            const now = Date.now();
            db.prepare(
                "UPDATE task SET status = 'abandoned', last_event_at = ?, ended_at = ? WHERE session_id = ? AND id = ?",
            ).run(now, now, options.sessionId, options.id);
            db.prepare(`
                INSERT INTO task_event (session_id, task_id, at, kind, summary)
                VALUES (?, ?, ?, ?, ?)
            `).run(options.sessionId, options.id, now, "abandoned", options.eventSummary ?? null);
            db.exec("COMMIT");
            const record = this.selectRecord(db, options.sessionId, options.id);
            if (!record) {
                throw new Error(`Task not found after update: ${options.id}`);
            }
            return record;
        } catch (err) {
            try {
                db.exec("ROLLBACK");
            } catch {
                // Ignore rollback failure — original error is more important.
            }
            throw err;
        }
    }

    async rename(input: TaskRenameInput): Promise<TaskRecord> {
        await this.yieldToEventLoop();
        const db = this.database.getDb();
        db.exec("BEGIN");
        try {
            // Existence check only — rename is allowed in any state.
            this.requireRecord(db, input.sessionId, input.id);
            const now = Date.now();
            db.prepare(
                "UPDATE task SET summary = ?, last_event_at = ? WHERE session_id = ? AND id = ?",
            ).run(input.summary, now, input.sessionId, input.id);
            db.prepare(`
                INSERT INTO task_event (session_id, task_id, at, kind, summary)
                VALUES (?, ?, ?, ?, ?)
            `).run(input.sessionId, input.id, now, "renamed", input.summary);
            db.exec("COMMIT");
            const record = this.selectRecord(db, input.sessionId, input.id);
            if (!record) {
                throw new Error(`Task not found after update: ${input.id}`);
            }
            return record;
        } catch (err) {
            try {
                db.exec("ROLLBACK");
            } catch {
                // Ignore rollback failure — original error is more important.
            }
            throw err;
        }
    }

    private async yieldToEventLoop(): Promise<void> {
        return new Promise(resolve => setImmediate(resolve));
    }

    private selectRecord(
        db: DatabaseSync,
        sessionId: string,
        id: string,
    ): TaskRecord | null {
        const row = db
            .prepare("SELECT * FROM task WHERE session_id = ? AND id = ?")
            .get(sessionId, id) as Record<string, unknown> | undefined;
        return row ? rowToRecord(row) : null;
    }

    private requireRecord(
        db: DatabaseSync,
        sessionId: string,
        id: string,
    ): TaskRecord {
        const record = this.selectRecord(db, sessionId, id);
        if (!record) {
            throw new Error(`Task not found: ${id}`);
        }
        return record;
    }
}

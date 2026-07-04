import type { DatabaseSync } from "node:sqlite";

const TASK_ID_PATTERN = /^T\d+(\.\d+)*$/;

/**
 * Allocates the next sequential task ID for a session.
 *
 * Top-level (parentId nullish): returns "T<n>" where n is one greater than the
 * max existing top-level n in the session, or "T1" when none exist.
 *
 * Sub-task (parentId provided): returns "<parentId>.<m>" where m is one greater
 * than the max existing child segment under parentId, or "<parentId>.1" when
 * the parent has no children.
 *
 * Synchronous — the caller is responsible for holding a transaction; this
 * function does not open one.
 *
 * Throws:
 *   - "Invalid task ID: <parentId>" if parentId does not match /^T\d+(\.\d+)*$/.
 *   - "Parent task not found: <parentId>" if no task row exists for parentId in
 *     the given session.
 */
export function nextTaskId(db: DatabaseSync, sessionId: string, parentId?: string): string {
    if (parentId === undefined || parentId === null) {
        return allocateTopLevel(db, sessionId);
    }
    return allocateSubTask(db, sessionId, parentId);
}

function allocateTopLevel(db: DatabaseSync, sessionId: string): string {
    const rows = db.prepare(
        "SELECT id FROM task WHERE session_id = ? AND parent_task_id IS NULL"
    ).all(sessionId) as Array<{ id: string }>;

    let max = 0;
    for (const row of rows) {
        const match = row.id.match(/^T(\d+)/);
        if (!match) continue;
        const n = parseInt(match[1], 10);
        if (Number.isNaN(n)) continue;
        if (n > max) max = n;
    }
    return `T${max + 1}`;
}

function allocateSubTask(db: DatabaseSync, sessionId: string, parentId: string): string {
    if (!TASK_ID_PATTERN.test(parentId)) {
        throw new Error(`Invalid task ID: ${parentId}`);
    }

    const parent = db.prepare(
        "SELECT 1 FROM task WHERE session_id = ? AND id = ?"
    ).get(sessionId, parentId);
    if (!parent) {
        throw new Error(`Parent task not found: ${parentId}`);
    }

    const rows = db.prepare(
        "SELECT id FROM task WHERE session_id = ? AND parent_task_id = ?"
    ).all(sessionId, parentId) as Array<{ id: string }>;

    const prefix = `${parentId}.`;
    let max = 0;
    for (const row of rows) {
        if (!row.id.startsWith(prefix)) continue;
        const suffix = row.id.slice(prefix.length);
        const m = parseInt(suffix, 10);
        if (Number.isNaN(m)) continue;
        if (m > max) max = m;
    }
    return `${parentId}.${max + 1}`;
}

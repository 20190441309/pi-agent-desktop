// SQLite Session Store — v1.2 baseline
// Replaces JSON file persistence with SQLite for session indexing.
// Uses better-sqlite3 (synchronous, in-process, zero-latency).
// Full migration from session-store.ts is a follow-up slice.
//
// Schema supports Pi JSONL v3 tree structure:
// - messages.parent_id links to parent message (undefined/null = root)
// - This preserves branching/forking rather than flattening to a linear array
// - Enables: branch navigation, compaction without data loss, fork from any message

import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import log from 'electron-log/main';

let db: Database.Database | null = null;

function getDbPath(): string {
    return join(app.getPath('userData'), 'sessions.db');
}

export function getSessionDb(): Database.Database {
    if (db) return db;

    db = new Database(getDbPath());
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // v1 schema — baseline tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            title TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            archived INTEGER DEFAULT 0,
            favorite INTEGER DEFAULT 0,
            read_only INTEGER DEFAULT 0,
            summary TEXT,
            parent_session_id TEXT,
            forked_from_message_id TEXT,
            forked_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at);

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL DEFAULT '',
            timestamp INTEGER NOT NULL,
            thinking TEXT,
            parent_id TEXT,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
        CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);

        CREATE TABLE IF NOT EXISTS tool_calls (
            id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL,
            name TEXT NOT NULL,
            input TEXT,
            output TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'error')),
            start_time INTEGER,
            end_time INTEGER,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_tool_calls_message ON tool_calls(message_id);

        CREATE TABLE IF NOT EXISTS session_metadata (
            session_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            PRIMARY KEY (session_id, key),
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );
    `);

    log.info('[session-sqlite] Database initialized at', getDbPath());
    return db;
}

export function closeSessionDb(): void {
    if (db) {
        db.close();
        db = null;
        log.info('[session-sqlite] Database closed');
    }
}

// Query helpers (to be expanded in migration slice)

export function listSessionsByWorkspace(workspaceId: string): Array<{ id: string; title: string; updatedAt: number }> {
    const d = getSessionDb();
    return d.prepare('SELECT id, title, updated_at as updatedAt FROM sessions WHERE workspace_id = ? ORDER BY updated_at DESC').all(workspaceId) as Array<{ id: string; title: string; updatedAt: number }>;
}

export function insertSession(session: {
    id: string; workspaceId: string; title: string; createdAt: number; updatedAt: number;
}): void {
    const d = getSessionDb();
    d.prepare(
        'INSERT OR REPLACE INTO sessions (id, workspace_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(session.id, session.workspaceId, session.title, session.createdAt, session.updatedAt);
}

export function deleteSession(sessionId: string): void {
    const d = getSessionDb();
    d.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}
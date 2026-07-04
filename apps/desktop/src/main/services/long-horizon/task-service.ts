import type { LongHorizonTaskListInput, LongHorizonTaskRecord } from "@shared";
import type { LongHorizonDatabase } from "./database";
import {
    TaskRegistry,
    type TaskBlockOptions,
    type TaskCreateInput,
    type TaskListOptions,
    type TaskRecord,
    type TaskRenameInput,
    type TaskStartOptions,
} from "./task-registry";

/**
 * TaskService — Phase B Task 3 thin wrapper.
 *
 * Holds two surfaces:
 *  1. Legacy API (`setSourceTasks` / `list` / `getActive`) — delegates directly
 *     to `LongHorizonDatabase` for backward compatibility with goal-service and
 *     agent-runtime callers that depend on user-supplied task IDs and per-source
 *     snapshots. Preserved verbatim from the pre-Task-3 implementation.
 *  2. New registry-backed API (`createTask` / `listTasks` / `getTask` /
 *     `startTask` / `blockTask` / `unblockTask` / `doneTask` / `abandonTask` /
 *     `renameTask`) — delegates to `TaskRegistry`, which allocates `T<n>(.<m>)*`
 *     IDs and event-sources every state transition into `task_event`.
 */
export class TaskService {
    private readonly registry: TaskRegistry;

    constructor(private readonly database: LongHorizonDatabase) {
        this.registry = new TaskRegistry(database);
    }

    /** @deprecated Legacy per-source snapshot writer — kept for goal-service. */
    async setSourceTasks(
        workspaceId: string,
        agentId: string | undefined,
        source: "goal" | "plan",
        items: Array<Pick<LongHorizonTaskRecord, "id" | "text" | "status">>,
    ): Promise<void> {
        await this.database.setSourceTasks(workspaceId, agentId, source, items);
    }

    /** @deprecated Legacy list — returns LongHorizonTaskRecord shape. */
    async list(input: LongHorizonTaskListInput): Promise<LongHorizonTaskRecord[]> {
        return this.database.listTasks(input);
    }

    /** @deprecated Legacy active lookup — returns LongHorizonTaskRecord shape. */
    async getActive(input: LongHorizonTaskListInput): Promise<LongHorizonTaskRecord | null> {
        return this.database.getActiveTask(input);
    }

    getRegistry(): TaskRegistry {
        return this.registry;
    }

    async createTask(input: TaskCreateInput): Promise<TaskRecord> {
        return this.registry.create(input);
    }

    async listTasks(options: TaskListOptions): Promise<TaskRecord[]> {
        return this.registry.list(options);
    }

    async getTask(sessionId: string, id: string): Promise<TaskRecord | null> {
        return this.registry.get(sessionId, id);
    }

    async startTask(options: TaskStartOptions): Promise<TaskRecord> {
        return this.registry.start(options);
    }

    async blockTask(options: TaskBlockOptions): Promise<TaskRecord> {
        return this.registry.block(options);
    }

    async unblockTask(options: TaskBlockOptions): Promise<TaskRecord> {
        return this.registry.unblock(options);
    }

    async doneTask(options: TaskBlockOptions): Promise<TaskRecord> {
        return this.registry.done(options);
    }

    async abandonTask(options: TaskBlockOptions): Promise<TaskRecord> {
        return this.registry.abandon(options);
    }

    async renameTask(input: TaskRenameInput): Promise<TaskRecord> {
        return this.registry.rename(input);
    }
}

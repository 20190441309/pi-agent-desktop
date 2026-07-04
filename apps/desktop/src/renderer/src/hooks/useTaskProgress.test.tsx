// @vitest-environment jsdom

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GoalState, LongHorizonTaskRecord, PlanProgressUpdate } from "@shared";
import { useTaskProgress } from "./useTaskProgress";
import { useWorkspaceStore } from "../stores/workspace-store";

let emitPlanProgress: ((update: PlanProgressUpdate) => void) | null = null;
let emitGoalChanged: ((goal: GoalState) => void) | null = null;
const taskList = vi.fn<() => Promise<LongHorizonTaskRecord[]>>();

function HookHost({ agentId }: { agentId?: string | null }): React.JSX.Element {
    const { tasks } = useTaskProgress(agentId);
    return (
        <ul>
            {tasks.map((task) => (
                <li key={task.id}>{task.name}</li>
            ))}
        </ul>
    );
}

beforeEach(() => {
    emitPlanProgress = null;
    emitGoalChanged = null;
    taskList.mockReset();
    useWorkspaceStore.setState({
        workspaces: [
            {
                id: "ws1",
                name: "demo",
                path: "C:/demo",
                createdAt: new Date(1),
                lastActiveAt: new Date(1),
            },
        ],
        currentWorkspaceId: "ws1",
        lastError: null,
    });
    (globalThis as { window: unknown }).window = window;
    Object.assign(window, {
        piAPI: {
            // Phase B Task 4 renamed the legacy surface to legacyTaskList;
            // the hook calls legacyTaskList, so the mock must match.
            legacyTaskList: taskList,
            onPlanProgress: vi.fn((cb: (update: PlanProgressUpdate) => void) => {
                emitPlanProgress = cb;
                return vi.fn();
            }),
            onGoalChanged: vi.fn((cb: (goal: GoalState) => void) => {
                emitGoalChanged = cb;
                return vi.fn();
            }),
        },
    });
});

describe("useTaskProgress", () => {
    it("loads task registry rows for the current workspace", async () => {
        taskList.mockResolvedValue([
            {
                id: "T1",
                workspaceId: "ws1",
                source: "goal",
                text: "finish migration",
                status: "running",
                ordinal: 0,
                createdAt: 1,
                updatedAt: 2,
            },
        ]);

        await act(async () => {
            render(<HookHost />);
        });

        await screen.findByText("finish migration");
        expect(taskList).toHaveBeenCalledWith({ workspaceId: "ws1", agentId: undefined });
    });

    it("passes the current agent scope through to task list queries when provided", async () => {
        taskList.mockResolvedValue([
            {
                id: "T_agent",
                workspaceId: "ws1",
                agentId: "agent-1",
                source: "goal",
                text: "agent scoped task",
                status: "running",
                ordinal: 0,
                createdAt: 1,
                updatedAt: 2,
            },
        ]);

        await act(async () => {
            render(<HookHost agentId="agent-1" />);
        });

        await screen.findByText("agent scoped task");
        expect(taskList).toHaveBeenCalledWith({ workspaceId: "ws1", agentId: "agent-1" });
    });

    it("refreshes task registry rows when plan progress updates arrive", async () => {
        taskList
            .mockResolvedValueOnce([
                {
                    id: "T1",
                    workspaceId: "ws1",
                    source: "plan",
                    text: "old plan step",
                    status: "running",
                    ordinal: 0,
                    createdAt: 1,
                    updatedAt: 2,
                },
            ])
            .mockResolvedValueOnce([
                {
                    id: "T2",
                    workspaceId: "ws1",
                    source: "plan",
                    text: "new plan step",
                    status: "waiting",
                    ordinal: 0,
                    createdAt: 3,
                    updatedAt: 4,
                },
            ]);

        await act(async () => {
            render(<HookHost />);
        });
        await screen.findByText("old plan step");

        await act(async () => {
            emitPlanProgress?.({
                workspaceId: "ws1",
                status: "executing",
                items: [{ id: "T2", text: "new plan step", status: "waiting" }],
            });
        });

        await screen.findByText("new plan step");
        expect(taskList).toHaveBeenCalledTimes(2);
    });

    it("refreshes task registry rows when goal state changes", async () => {
        taskList
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: "T1",
                    workspaceId: "ws1",
                    source: "goal",
                    text: "ship desktop build",
                    status: "running",
                    ordinal: 0,
                    createdAt: 5,
                    updatedAt: 6,
                },
            ]);

        await act(async () => {
            render(<HookHost />);
        });

        await act(async () => {
            emitGoalChanged?.({
                id: "goal-1",
                workspaceId: "ws1",
                condition: "ship desktop build",
                status: "running",
                updatedAt: 6,
            });
        });

        await waitFor(() => {
            expect(screen.getByText("ship desktop build")).toBeTruthy();
        });
        expect(taskList).toHaveBeenCalledTimes(2);
    });
});

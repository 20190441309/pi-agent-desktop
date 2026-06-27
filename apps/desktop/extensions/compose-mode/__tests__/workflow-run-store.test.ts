import { describe, expect, it } from "vitest";
import { WorkflowRunStore, workflowPhaseLines } from "../workflow-run-store";

describe("WorkflowRunStore", () => {
    it("creates a compose run with default phase rows", () => {
        const store = new WorkflowRunStore();
        const run = store.createComposeRun("审查 compose runtime");

        expect(run.status).toBe("running");
        expect(run.task).toBe("审查 compose runtime");
        expect(run.phases.map((phase) => phase.name)).toEqual([
            "Brainstorm",
            "Design",
            "Implement",
            "Verify",
            "Review",
            "Report",
            "Merge",
        ]);
        expect(workflowPhaseLines(run)[0]).toBe("[ ] Brainstorm");
    });

    it("tracks phase transitions and completion", async () => {
        const store = new WorkflowRunStore();
        const run = store.createComposeRun("实现 compose tool");
        store.beginPhase(run.id, "Brainstorm");
        store.completePhase(run.id, "Brainstorm", "gathered repo context");
        store.complete(run.id, {
            status: "completed",
            summary: "workflow complete",
            artifacts: ["spec.md"],
            phaseSummaries: ["Brainstorm: gathered repo context"],
        });

        const snapshot = store.get(run.id);
        expect(snapshot).toMatchObject({
            status: "completed",
            currentPhase: "Brainstorm",
            outcome: expect.objectContaining({
                summary: "workflow complete",
            }),
        });
        await expect(store.wait(run.id)).resolves.toMatchObject({
            status: "completed",
        });
    });
});

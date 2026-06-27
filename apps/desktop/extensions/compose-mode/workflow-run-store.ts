import { randomUUID } from "node:crypto";
import type {
    WorkflowPhaseRecord,
    WorkflowPhaseStatus,
    WorkflowRunOutcome,
    WorkflowRunSnapshot,
} from "./types.ts";

interface StoredRun {
    snapshot: WorkflowRunSnapshot;
    abortController: AbortController;
    resolveWait: (outcome: WorkflowRunOutcome) => void;
    waitPromise: Promise<WorkflowRunOutcome>;
}

const DEFAULT_PHASES = [
    "Brainstorm",
    "Design",
    "Implement",
    "Verify",
    "Review",
    "Report",
    "Merge",
] as const;

export class WorkflowRunStore {
    private readonly runs = new Map<string, StoredRun>();

    createComposeRun(task: string, artifacts: string[] = []): WorkflowRunSnapshot {
        const id = randomUUID();
        const createdAt = Date.now();
        let resolveWait: (outcome: WorkflowRunOutcome) => void = () => undefined;
        const waitPromise = new Promise<WorkflowRunOutcome>((resolve) => {
            resolveWait = resolve;
        });
        const snapshot: WorkflowRunSnapshot = {
            id,
            name: "compose",
            status: "running",
            task,
            createdAt,
            updatedAt: createdAt,
            artifacts,
            phases: DEFAULT_PHASES.map((name) => ({ name, status: "pending" })),
        };
        this.runs.set(id, {
            snapshot,
            abortController: new AbortController(),
            resolveWait,
            waitPromise,
        });
        return this.cloneSnapshot(snapshot);
    }

    get(runId: string): WorkflowRunSnapshot | null {
        const run = this.runs.get(runId);
        return run ? this.cloneSnapshot(run.snapshot) : null;
    }

    wait(runId: string): Promise<WorkflowRunOutcome> {
        const run = this.runs.get(runId);
        if (!run) {
            return Promise.resolve({
                status: "failed",
                summary: `unknown workflow run: ${runId}`,
                artifacts: [],
                phaseSummaries: [],
                error: `unknown workflow run: ${runId}`,
            });
        }
        if (run.snapshot.outcome) {
            return Promise.resolve(run.snapshot.outcome);
        }
        return run.waitPromise;
    }

    abortSignal(runId: string): AbortSignal | undefined {
        return this.runs.get(runId)?.abortController.signal;
    }

    requestCancel(runId: string, reason = "workflow cancelled"): WorkflowRunSnapshot | null {
        const run = this.runs.get(runId);
        if (!run) return null;
        if (run.snapshot.status !== "running") return this.cloneSnapshot(run.snapshot);
        run.abortController.abort(reason);
        const outcome: WorkflowRunOutcome = {
            status: "cancelled",
            summary: reason,
            artifacts: [...run.snapshot.artifacts],
            phaseSummaries: this.phaseSummaries(run.snapshot.phases),
        };
        run.snapshot = {
            ...run.snapshot,
            status: "cancelled",
            updatedAt: Date.now(),
            outcome,
        };
        run.resolveWait(outcome);
        return this.cloneSnapshot(run.snapshot);
    }

    setArtifacts(runId: string, artifacts: string[]): WorkflowRunSnapshot | null {
        const run = this.runs.get(runId);
        if (!run) return null;
        run.snapshot = {
            ...run.snapshot,
            artifacts: [...artifacts],
            updatedAt: Date.now(),
        };
        return this.cloneSnapshot(run.snapshot);
    }

    beginPhase(runId: string, phaseName: string): WorkflowRunSnapshot | null {
        return this.updatePhase(runId, phaseName, "running");
    }

    completePhase(runId: string, phaseName: string, summary?: string): WorkflowRunSnapshot | null {
        return this.updatePhase(runId, phaseName, "completed", summary);
    }

    skipPhase(runId: string, phaseName: string, summary?: string): WorkflowRunSnapshot | null {
        return this.updatePhase(runId, phaseName, "skipped", summary);
    }

    failPhase(runId: string, phaseName: string, summary?: string): WorkflowRunSnapshot | null {
        return this.updatePhase(runId, phaseName, "failed", summary);
    }

    complete(runId: string, outcome: WorkflowRunOutcome): WorkflowRunSnapshot | null {
        const run = this.runs.get(runId);
        if (!run) return null;
        run.snapshot = {
            ...run.snapshot,
            status: "completed",
            updatedAt: Date.now(),
            outcome,
            error: undefined,
        };
        run.resolveWait(outcome);
        return this.cloneSnapshot(run.snapshot);
    }

    fail(runId: string, error: string, phaseSummaries: string[] = []): WorkflowRunSnapshot | null {
        const run = this.runs.get(runId);
        if (!run) return null;
        const outcome: WorkflowRunOutcome = {
            status: "failed",
            summary: error,
            artifacts: [...run.snapshot.artifacts],
            phaseSummaries: phaseSummaries.length > 0 ? phaseSummaries : this.phaseSummaries(run.snapshot.phases),
            error,
        };
        run.snapshot = {
            ...run.snapshot,
            status: "failed",
            updatedAt: Date.now(),
            outcome,
            error,
        };
        run.resolveWait(outcome);
        return this.cloneSnapshot(run.snapshot);
    }

    private updatePhase(
        runId: string,
        phaseName: string,
        status: WorkflowPhaseStatus,
        summary?: string,
    ): WorkflowRunSnapshot | null {
        const run = this.runs.get(runId);
        if (!run) return null;
        const now = Date.now();
        const phases = run.snapshot.phases.map((phase): WorkflowPhaseRecord => {
            if (phase.name !== phaseName) return phase;
            return {
                ...phase,
                status,
                startedAt: phase.startedAt ?? now,
                endedAt: status === "running" ? undefined : now,
                summary: summary ?? phase.summary,
            };
        });
        run.snapshot = {
            ...run.snapshot,
            currentPhase: phaseName,
            phases,
            updatedAt: now,
        };
        return this.cloneSnapshot(run.snapshot);
    }

    private phaseSummaries(phases: WorkflowPhaseRecord[]): string[] {
        return phases
            .filter((phase) => phase.summary && phase.summary.trim())
            .map((phase) => `${phase.name}: ${phase.summary!.trim()}`);
    }

    private cloneSnapshot(snapshot: WorkflowRunSnapshot): WorkflowRunSnapshot {
        return {
            ...snapshot,
            artifacts: [...snapshot.artifacts],
            phases: snapshot.phases.map((phase) => ({ ...phase })),
            outcome: snapshot.outcome
                ? {
                    ...snapshot.outcome,
                    artifacts: [...snapshot.outcome.artifacts],
                    phaseSummaries: [...snapshot.outcome.phaseSummaries],
                }
                : undefined,
        };
    }
}

export function workflowPhaseLines(snapshot: WorkflowRunSnapshot): string[] {
    return snapshot.phases.map((phase) => {
        if (phase.status === "running") return `▶ ${phase.name}`;
        if (phase.status === "completed") return `[x] ${phase.name}`;
        if (phase.status === "failed") return `[!] ${phase.name}`;
        if (phase.status === "skipped") return `[-] ${phase.name}`;
        return `[ ] ${phase.name}`;
    });
}

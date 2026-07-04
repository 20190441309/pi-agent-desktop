import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LONG_HORIZON_SETTINGS, type LongHorizonSettings } from "@shared";
import { LongHorizonDatabase } from "../database";
import { GoalService, MAX_GOAL_REACT } from "../goal-service";
import type { JudgeModelClient, ResolvedModel, ResolvedProvider } from "../judge-model-client";

// ── Phase C Task 5 SubTask 5.8: judge-integration.test.ts ────────────────
//
// End-to-end integration tests for the judge model evaluation loop. Uses a
// real LongHorizonDatabase (no DB mock) + a real GoalService wiring together
// the judge client, model resolver, and agent-session lookup. Only the
// JudgeModelClient.complete and followUp side effects are mocked — the rest
// of the GoalService → Database → event payload pipeline runs for real.
//
// Covers the four stop-gate behaviours required by the spec:
//   1. inconclusive → followUp + react increment; satisfied → stop
//   2. MAX_GOAL_REACT exceeded → goal failed (fail-open)
//   3. periodic mode (evaluateInterval=3) → evaluate on turn 3, 6, ...
//   4. goal disabled → onTurnEnd no-op
//   5. goal:evaluation event payload structure

describe("Judge integration (end-to-end)", () => {
    let dir: string;
    let db: LongHorizonDatabase;
    let goalService: GoalService;
    let mockJudgeClient: { complete: ReturnType<typeof vi.fn> };
    let followUpCalls: string[];

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "pi-judge-int-"));
        db = new LongHorizonDatabase(dir);
        followUpCalls = [];
        mockJudgeClient = {
            complete: vi.fn(),
        };
        // GoalService with stop-gate mode (default; getEvaluateInterval=0).
        goalService = new GoalService({
            database: db,
            send: () => {},
            judgeModelClient: mockJudgeClient as unknown as JudgeModelClient,
            resolveActiveModel: async () => ({
                provider: {
                    id: "test",
                    baseUrl: "https://example.com",
                    api: "openai-completions",
                } satisfies ResolvedProvider,
                model: { id: "test-model" } satisfies ResolvedModel,
            }),
            agentSessionLookup: () => ({
                followUp: async (message: string) => {
                    followUpCalls.push(message);
                },
            }),
        });
    });

    afterEach(async () => {
        await goalService.close();
        await db.close();
        rmSync(dir, { recursive: true, force: true });
    });

    it("stop-gate: inconclusive → followUp + react increment; satisfied → stop", async () => {
        // 1. Set a goal — status flips to "running".
        await goalService.set({ workspaceId: "ws-1", condition: "feature is done" });
        const goal = await goalService.get("ws-1");
        expect(goal?.status).toBe("running");

        // 2. First turn_end: mock judge returns inconclusive.
        mockJudgeClient.complete.mockResolvedValueOnce({
            ok: false,
            reason: "not yet, still working",
        });
        await goalService.onTurnEnd("ws-1", "agent-1");

        // 3. followUp was injected with the verdict reason; react bumped to 1.
        expect(followUpCalls).toEqual(["not yet, still working"]);
        expect(goalService.getReact("ws-1")).toBe(1);
        // Goal stays running — inconclusive-within-cap does NOT call applyVerdict.
        expect((await goalService.get("ws-1"))?.status).toBe("running");

        // 4. Second turn_end: mock judge returns satisfied.
        mockJudgeClient.complete.mockResolvedValueOnce({
            ok: true,
            reason: "feature implemented",
        });
        await goalService.onTurnEnd("ws-1", "agent-1");

        // 5. followUp was NOT called again (satisfied → agent stops naturally).
        expect(followUpCalls).toHaveLength(1);
        const finalGoal = await goalService.get("ws-1");
        expect(finalGoal?.status).toBe("satisfied");
        expect(finalGoal?.reason).toBe("feature implemented");
    });

    it("MAX_GOAL_REACT exceeded → goal failed", async () => {
        await goalService.set({ workspaceId: "ws-2", condition: "feature is done" });

        // Drive MAX_GOAL_REACT + 1 inconclusive turn_end events. Each call
        // bumps the react counter; the 13th bump (react=13 > MAX_GOAL_REACT=12)
        // triggers the fail-open branch which marks the goal as impossible.
        for (let i = 0; i < MAX_GOAL_REACT + 1; i++) {
            mockJudgeClient.complete.mockResolvedValueOnce({
                ok: false,
                reason: `attempt ${i + 1}`,
            });
            await goalService.onTurnEnd("ws-2", "agent-1");
        }

        const goal = await goalService.get("ws-2");
        expect(goal?.status).toBe("impossible");
        expect(goal?.reason).toMatch(/exceeded MAX_GOAL_REACT/);
        // React counter ends at MAX_GOAL_REACT + 1.
        expect(goalService.getReact("ws-2")).toBe(MAX_GOAL_REACT + 1);
        // followUp was injected on the first 12 inconclusive turns; the 13th
        // short-circuits to fail-open without injecting a followUp.
        expect(followUpCalls).toHaveLength(MAX_GOAL_REACT);
    });

    it("periodic mode: evaluateInterval=3 → evaluate on turn 3, 6, ... (no followUp)", async () => {
        // Build a GoalService whose private getEvaluateInterval returns 3
        // (periodic mode). The current GoalService always returns 0 (stop-gate
        // mode) — we monkey-patch the instance to enable periodic mode for
        // this test. The verdict is still inconclusive so the goal stays
        // "running" and we can observe multiple evaluate cycles.
        const periodicService = new GoalService({
            database: db,
            send: () => {},
            judgeModelClient: mockJudgeClient as unknown as JudgeModelClient,
            resolveActiveModel: async () => ({
                provider: {
                    id: "test",
                    baseUrl: "https://example.com",
                    api: "openai-completions",
                } satisfies ResolvedProvider,
                model: { id: "test-model" } satisfies ResolvedModel,
            }),
            agentSessionLookup: () => ({
                followUp: async (message: string) => {
                    followUpCalls.push(message);
                },
            }),
        });
        // Override the (private) getEvaluateInterval to enable periodic mode.
        // Instance own-property assignment shadows the prototype method.
        Object.defineProperty(periodicService, "getEvaluateInterval", {
            value: () => 3,
            configurable: true,
        });

        await periodicService.set({ workspaceId: "ws-3", condition: "build feature" });

        // Turns 1 & 2: turnCount % 3 !== 0 → skip evaluate.
        await periodicService.onTurnEnd("ws-3", "agent-1");
        await periodicService.onTurnEnd("ws-3", "agent-1");
        expect(mockJudgeClient.complete).not.toHaveBeenCalled();

        // Turn 3: turnCount % 3 === 0 → evaluate. Return inconclusive so the
        // goal stays "running" and we can observe the next evaluate cycle.
        mockJudgeClient.complete.mockResolvedValueOnce({ ok: false, reason: "not yet 3" });
        await periodicService.onTurnEnd("ws-3", "agent-1");
        expect(mockJudgeClient.complete).toHaveBeenCalledTimes(1);
        // Periodic mode does NOT inject followUp on inconclusive (informational only).
        expect(followUpCalls).toHaveLength(0);
        // Goal stays running — inconclusive in periodic mode keeps status running.
        expect((await periodicService.get("ws-3"))?.status).toBe("running");

        // Turns 4 & 5: not on interval → skip evaluate.
        await periodicService.onTurnEnd("ws-3", "agent-1");
        await periodicService.onTurnEnd("ws-3", "agent-1");
        expect(mockJudgeClient.complete).toHaveBeenCalledTimes(1);

        // Turn 6: on interval → evaluate. Return inconclusive again.
        mockJudgeClient.complete.mockResolvedValueOnce({ ok: false, reason: "not yet 6" });
        await periodicService.onTurnEnd("ws-3", "agent-1");
        expect(mockJudgeClient.complete).toHaveBeenCalledTimes(2);
        // Periodic mode still does NOT inject followUp.
        expect(followUpCalls).toHaveLength(0);

        await periodicService.close();
    });

    it("goal disabled → onTurnEnd no-op", async () => {
        // Construct a GoalService whose getLongHorizonSettings reports
        // longHorizon.enabled=true but goal.enabled=false. onTurnEnd must
        // short-circuit before invoking the judge client.
        const goalDisabledSettings: LongHorizonSettings = {
            ...DEFAULT_LONG_HORIZON_SETTINGS,
            enabled: true,
            goal: { enabled: false },
        };
        const disabledService = new GoalService({
            database: db,
            send: () => {},
            judgeModelClient: mockJudgeClient as unknown as JudgeModelClient,
            getLongHorizonSettings: () => goalDisabledSettings,
        });

        await disabledService.set({ workspaceId: "ws-4", condition: "feature" });
        await disabledService.onTurnEnd("ws-4", "agent-1");

        expect(mockJudgeClient.complete).not.toHaveBeenCalled();
        // turnCount stays at 0 — the early-return fires before bumpTurn.
        expect(disabledService.getTurnCount("ws-4")).toBe(0);
        // Goal stays running (no verdict applied).
        expect((await disabledService.get("ws-4"))?.status).toBe("running");

        await disabledService.close();
    });

    it("goal:evaluation event payload structure", async () => {
        const events: Array<{ wsId: string; payload: Record<string, unknown> }> = [];
        const eventService = new GoalService({
            database: db,
            send: (channel, wsId, payload) => {
                if (channel === "goal:evaluation") {
                    events.push({ wsId, payload: payload as Record<string, unknown> });
                }
            },
            judgeModelClient: mockJudgeClient as unknown as JudgeModelClient,
            resolveActiveModel: async () => ({
                provider: {
                    id: "test",
                    baseUrl: "https://example.com",
                    api: "openai-completions",
                } satisfies ResolvedProvider,
                model: { id: "test-model" } satisfies ResolvedModel,
            }),
            // agentSessionLookup returns null — no followUp path. evaluate
            // still fires + emits the goal:evaluation event.
            agentSessionLookup: () => null,
        });

        await eventService.set({ workspaceId: "ws-5", condition: "feature" });
        // Satisfied verdict → applyVerdict → emitEvaluation fires exactly once.
        mockJudgeClient.complete.mockResolvedValueOnce({ ok: true, reason: "done" });
        await eventService.onTurnEnd("ws-5", "agent-1");

        expect(events).toHaveLength(1);
        const event = events[0];
        expect(event.wsId).toBe("ws-5");
        expect(event.payload).toMatchObject({
            workspaceId: "ws-5",
            agentId: "agent-1",
            verdict: "satisfied",
            reason: "done",
            attempt: expect.any(Number),
            judgedMessageId: undefined,
            error: false,
        });

        await eventService.close();
    });
});

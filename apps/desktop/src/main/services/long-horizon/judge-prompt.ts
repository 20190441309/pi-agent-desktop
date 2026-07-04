import { z } from "zod";

// ---- Judge prompts (ported from MiMo Code session/goal.ts) ----

export const JUDGE_SYSTEM = `You are evaluating a stop-condition hook in Mimo Code. Read the conversation transcript carefully, then judge whether the user-provided condition is satisfied.

Your response must be a JSON object with one of these shapes:
- {"ok": true, "reason": "<quote evidence from the transcript that satisfies the condition>"}
- {"ok": false, "reason": "<quote what is missing or what blocks the condition>"}
- {"ok": false, "impossible": true, "reason": "<explain why the condition can never be satisfied>"}

Always include a "reason" field, quoting specific text from the transcript whenever possible. If the transcript does not contain clear evidence that the condition is satisfied, return {"ok": false, "reason": "insufficient evidence in transcript"}.

Only use {"ok": false, "impossible": true} when the condition is genuinely unachievable in this session — for example: the condition is self-contradictory, it depends on a resource or capability that is unavailable, or the assistant has explicitly tried, exhausted reasonable approaches, and stated it cannot be done. Apply your own judgment when deciding this — the assistant claiming the goal is impossible is evidence, not proof; independently confirm the condition is genuinely unachievable rather than deferring to the assistant's self-assessment. Do not use it just because the goal has not been reached yet or because progress is slow. When in doubt, return {"ok": false} without "impossible".`;

// The closing question appended after the full conversation.
export const judgeUser = (condition: string): string =>
    `Based on the conversation transcript above, has the following stopping condition been satisfied? Answer based on transcript evidence only.

Condition: ${condition}`;

export const VerdictSchema = z.object({
    ok: z.boolean(),
    impossible: z.boolean().optional(),
    reason: z.string(),
});

export type Verdict = z.infer<typeof VerdictSchema>;

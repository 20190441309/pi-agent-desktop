/**
 * Plan mode directive prompt.
 *
 * Prepended to the user's message by `buildAgentModePrompt` when `mode === "plan"`
 * and plan mode is enabled. Mirrors the style of
 * `extensions/compose-mode/prompts.ts` DIRECTIVE_PROMPTS, but longer because
 * plan mode needs to constrain the agent to a read-only + `.pi/plans/`-only
 * contract.
 */
export const PLAN_DIRECTIVE = [
    "Plan mode is active. You are read-only.",
    "Output plans ONLY to `.pi/plans/<slug>.md` via the plan_write tool (or write tool with a `.pi/plans/` path).",
    "Do NOT modify source code, run build/test commands, or perform any write outside `.pi/plans/`.",
    "Explore the repository with read-only tools first; ground your plan in real evidence.",
    "Structure the plan: goal, files to touch, step sequence, verification checkpoints, risks.",
    "End your plan with A) / B) / C) choice options when the user needs to pick a direction.",
    "Wait for user confirmation before exiting plan mode or starting any implementation.",
].join("\n");

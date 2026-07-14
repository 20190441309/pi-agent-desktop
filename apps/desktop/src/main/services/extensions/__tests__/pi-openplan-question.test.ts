import { describe, expect, it, vi } from "vitest";
import { registerPlanQuestionTool } from "pi-openplan/extensions/plan-mode/question-prompt.ts";

describe("pi-openplan plan_question desktop fallback", () => {
    it("falls back to select when custom UI is unavailable", async () => {
        let tool: {
            execute: (...args: unknown[]) => Promise<{
                content: Array<{ type: string; text: string }>;
                details?: { answers?: string[][] };
                isError?: boolean;
            }>;
        } | undefined;
        const pi = {
            registerTool: vi.fn((definition: typeof tool) => {
                tool = definition;
            }),
        };
        const state = {
            metrics: { record: vi.fn() },
        };
        registerPlanQuestionTool(pi as never, state as never);

        const select = vi.fn(async () => "Provide Git URL");
        const result = await tool!.execute(
            "call_1",
            {
                questions: [{
                    question: "How should we continue?",
                    header: "Next step",
                    options: [
                        { label: "Provide Git URL", description: "Clone and inspect the repository" },
                        { label: "Use another path", description: "Inspect an existing local checkout" },
                    ],
                }],
            },
            undefined,
            undefined,
            {
                hasUI: true,
                ui: {
                    custom: vi.fn(async () => undefined),
                    select,
                    input: vi.fn(),
                },
            },
        );

        expect(result.isError).not.toBe(true);
        expect(result.details?.answers).toEqual([["Provide Git URL"]]);
        expect(result.content[0]?.text).toContain("Next step: Provide Git URL");
        expect(select).toHaveBeenCalledWith(
            "Next step\nHow should we continue?",
            [
                "Provide Git URL - Clone and inspect the repository",
                "Use another path - Inspect an existing local checkout",
                "Other...",
            ],
        );
    });
});

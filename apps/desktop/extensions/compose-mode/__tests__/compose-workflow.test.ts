import { describe, expect, it } from "vitest";
import { clampWorkflowChildTimeout } from "../compose-workflow";

describe("compose workflow deadlines", () => {
    it("caps a child phase to the remaining global workflow budget", () => {
        expect(clampWorkflowChildTimeout(20_000, 15 * 60_000, 12_500)).toBe(7_500);
    });

    it("preserves a shorter child timeout inside the global workflow budget", () => {
        expect(clampWorkflowChildTimeout(20_000, 2_000, 12_500)).toBe(2_000);
    });

    it("fails immediately after the global workflow deadline", () => {
        expect(() => clampWorkflowChildTimeout(20_000, 15 * 60_000, 20_000))
            .toThrow("compose.timeout: Compose 工作流超时");
    });
});

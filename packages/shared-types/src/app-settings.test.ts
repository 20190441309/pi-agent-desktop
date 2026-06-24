import { describe, expect, it } from "vitest";
import { mergeLongHorizonSettings, resolveAppSettings } from "./index";

describe("resolveAppSettings", () => {
    it("fills the desktop settings defaults for thinking and vision fields", () => {
        const settings = resolveAppSettings();

        expect(settings.showThinking).toBe(true);
        expect(settings.thinkingLevel).toBe("medium");
        expect(settings.visionProvider).toBe("");
        expect(settings.visionModel).toBe("");
        expect(settings.longHorizon?.enabled).toBe(true);
    });

    it("preserves explicit thinking and vision settings", () => {
        const settings = resolveAppSettings({
            showThinking: false,
            thinkingLevel: "high",
            visionProvider: "minimax",
            visionModel: "MiniMax-VL",
        });

        expect(settings.showThinking).toBe(false);
        expect(settings.thinkingLevel).toBe("high");
        expect(settings.visionProvider).toBe("minimax");
        expect(settings.visionModel).toBe("MiniMax-VL");
    });
});

describe("mergeLongHorizonSettings", () => {
    it("migrates legacy composeWorkflow into workflow defaults", () => {
        const merged = mergeLongHorizonSettings({
            enabled: true,
            composeWorkflow: { enabled: false },
        });

        expect(merged.workflow.enabled).toBe(false);
        expect(merged.composeWorkflow.enabled).toBe(false);
        expect(merged.workflow.maxConcurrentAgents).toBe(4);
        expect(merged.maxMode.candidates).toBe(5);
    });
});

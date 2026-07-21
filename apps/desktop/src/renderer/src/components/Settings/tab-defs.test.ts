import { describe, expect, it } from "vitest";
import { isSettingsTab } from "./tab-defs";

describe("isSettingsTab", () => {
  it("accepts known settings tab ids", () => {
    for (const id of [
      "model",
      "piagent",
      "permissions",
      "usage",
      "longHorizon",
      "appearance",
      "general",
      "shortcuts",
      "config",
      "about",
    ] as const) {
      expect(isSettingsTab(id)).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(isSettingsTab("models")).toBe(false);
    expect(isSettingsTab("")).toBe(false);
    expect(isSettingsTab(null)).toBe(false);
    expect(isSettingsTab(1)).toBe(false);
  });
});

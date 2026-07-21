import { describe, expect, it } from "vitest";
import {
  buildSettingsNavigation,
  flattenSettingsTabs,
  getDefaultSettingsAnchor,
  searchSettings,
} from "./settings-nav-metadata";

const t = (key: string): string => key;

describe("settings-nav-metadata", () => {
  const sections = buildSettingsNavigation(t);

  it("builds three nav sections with expected tabs", () => {
    expect(sections.map((s) => s.id)).toEqual(["common", "advanced", "maintenance"]);
    const tabs = flattenSettingsTabs(sections).map((tab) => tab.id);
    expect(tabs).toEqual([
      "general",
      "model",
      "piagent",
      "appearance",
      "permissions",
      "usage",
      "longHorizon",
      "shortcuts",
      "config",
      "about",
    ]);
  });

  it("returns empty search for blank query and ranks exact label matches", () => {
    expect(searchSettings(sections, "   ")).toEqual([]);
    expect(searchSettings(sections, "")).toEqual([]);

    const hits = searchSettings(sections, "settings.theme.label");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.tabId).toBe("appearance");
    expect(hits[0]?.anchor).toBe("appearance-theme");
    expect(hits[0]?.label).toBe("settings.theme.label");
  });

  it("matches multi-term queries against keywords", () => {
    const hits = searchSettings(sections, "CLI status");
    expect(hits.some((h) => h.tabId === "piagent" && h.anchor === "piagent-status")).toBe(true);
  });

  it("getDefaultSettingsAnchor prefixes page-", () => {
    expect(getDefaultSettingsAnchor("general")).toBe("page-general");
    expect(getDefaultSettingsAnchor("about")).toBe("page-about");
  });
});

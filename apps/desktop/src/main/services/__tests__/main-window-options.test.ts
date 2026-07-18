import { describe, expect, it } from "vitest";
import { resolveMainWindowChromeOptions, resolveMainWindowPerformancePreferences } from "../main-window-options";

describe("resolveMainWindowChromeOptions", () => {
  it("keeps the frameless Windows window opaque to avoid transparent-window composition stalls", () => {
    expect(resolveMainWindowChromeOptions("win32")).toEqual({
      backgroundColor: "#f4f4f4",
      transparent: false,
      frame: false,
    });
  });

  it("keeps the main renderer responsive while the window is occluded", () => {
    expect(resolveMainWindowPerformancePreferences()).toEqual({
      backgroundThrottling: false,
    });
  });

  it("preserves native macOS traffic lights without enabling transparency", () => {
    expect(resolveMainWindowChromeOptions("darwin")).toEqual({
      backgroundColor: "#f4f4f4",
      transparent: false,
      frame: true,
      titleBarStyle: "hiddenInset",
    });
  });
});

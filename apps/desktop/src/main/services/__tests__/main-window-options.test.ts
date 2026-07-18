import { describe, expect, it } from "vitest";
import { resolveMainWindowChromeOptions } from "../main-window-options";

describe("resolveMainWindowChromeOptions", () => {
  it("keeps the frameless Windows window opaque to avoid transparent-window composition stalls", () => {
    expect(resolveMainWindowChromeOptions("win32")).toEqual({
      backgroundColor: "#f4f4f4",
      transparent: false,
      frame: false,
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

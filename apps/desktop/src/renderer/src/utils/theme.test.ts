// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyFontSize,
  applyTheme,
  getDiffFontSize,
  getEditorFontSize,
  getInitialFontSize,
  getInitialTheme,
  normalizeFontSize,
  resolveTheme,
  watchSystemTheme,
} from "./theme";

describe("theme utils", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.cssText = "";
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolveTheme maps system via matchMedia", () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia });
    expect(resolveTheme("system")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("applyTheme sets data-theme attribute", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    applyTheme("system");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("normalizeFontSize clamps and defaults invalid values", () => {
    expect(normalizeFontSize(14)).toBe(14);
    expect(normalizeFontSize(8)).toBe(12);
    expect(normalizeFontSize(40)).toBe(20);
    expect(normalizeFontSize("16")).toBe(16);
    expect(normalizeFontSize("nope")).toBe(14);
    expect(normalizeFontSize(undefined)).toBe(14);
  });

  it("getEditorFontSize and getDiffFontSize derive from normalized body size", () => {
    expect(getEditorFontSize(14)).toBe(13);
    expect(getDiffFontSize(14)).toBe(11);
    expect(getEditorFontSize(12)).toBe(11);
    expect(getDiffFontSize(12)).toBe(10);
  });

  it("applyFontSize writes CSS custom properties", () => {
    const normalized = applyFontSize(16);
    expect(normalized).toBe(16);
    expect(document.documentElement.style.getPropertyValue("--font-size-body")).toBe("16px");
    expect(document.documentElement.style.getPropertyValue("--font-size-mono")).toBe("15px");
    expect(document.documentElement.style.getPropertyValue("--font-size-mono-small")).toBe("13px");
  });

  it("getInitialFontSize / getInitialTheme read localStorage", () => {
    localStorage.setItem("pi-desktop-font-size", "18");
    localStorage.setItem("pi-desktop-theme", "dark");
    expect(getInitialFontSize()).toBe(18);
    expect(getInitialTheme()).toBe("dark");
    localStorage.setItem("pi-desktop-theme", "invalid");
    expect(getInitialTheme()).toBe("system");
  });

  it("watchSystemTheme subscribes and unsubscribes", () => {
    const add = vi.fn();
    const remove = vi.fn();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: add,
        removeEventListener: remove,
      }),
    });
    const cb = vi.fn();
    const unsub = watchSystemTheme(cb);
    expect(add).toHaveBeenCalledWith("change", expect.any(Function));
    const handler = add.mock.calls[0]?.[1] as (e: MediaQueryListEvent) => void;
    handler({ matches: true } as MediaQueryListEvent);
    expect(cb).toHaveBeenCalledWith("dark");
    unsub();
    expect(remove).toHaveBeenCalledWith("change", handler);
  });
});

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyFontSize,
  applyTheme,
  getEditorFontSize,
  getInitialTheme,
  normalizeFontSize,
  resolveTheme,
  watchSystemTheme,
} from "../theme";

function stubMatchMedia(matches: boolean, listeners?: Array<(event: MediaQueryListEvent) => void>): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_type: string, handler: EventListenerOrEventListenerObject) => {
        if (typeof handler === "function") listeners?.push(handler as (event: MediaQueryListEvent) => void);
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe("theme utilities", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.cssText = "";
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves explicit light/dark and system preference", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");

    stubMatchMedia(true);
    expect(resolveTheme("system")).toBe("dark");

    stubMatchMedia(false);
    expect(resolveTheme("system")).toBe("light");
  });

  it("applies data-theme for light and dark (contrast surfaces)", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("reads stored theme and falls back to system", () => {
    expect(getInitialTheme()).toBe("system");
    window.localStorage.setItem("pi-desktop-theme", "dark");
    expect(getInitialTheme()).toBe("dark");
    window.localStorage.setItem("pi-desktop-theme", "bogus");
    expect(getInitialTheme()).toBe("system");
  });

  it("clamps font sizes used for readable body/editor text", () => {
    expect(normalizeFontSize(8)).toBe(12);
    expect(normalizeFontSize(40)).toBe(20);
    expect(normalizeFontSize("not-a-number")).toBe(14);
    expect(getEditorFontSize(14)).toBe(13);
  });

  it("writes CSS font tokens when applyFontSize runs", () => {
    const applied = applyFontSize(16);
    expect(applied).toBe(16);
    expect(document.documentElement.style.getPropertyValue("--font-size-body")).toBe("16px");
    expect(document.documentElement.style.getPropertyValue("--font-size-mono")).toBe("15px");
  });

  it("watches prefers-color-scheme changes for system theme", () => {
    const listeners: Array<(event: MediaQueryListEvent) => void> = [];
    stubMatchMedia(false, listeners);

    const callback = vi.fn();
    const unwatch = watchSystemTheme(callback);
    listeners[0]?.({ matches: true } as MediaQueryListEvent);
    expect(callback).toHaveBeenCalledWith("dark");
    unwatch();
  });

  it("keeps light and dark token surfaces distinct for contrast", () => {
    // Product uses data-theme attribute; CSS variables switch in globals.css.
    applyTheme("light");
    const light = document.documentElement.getAttribute("data-theme");
    applyTheme("dark");
    const dark = document.documentElement.getAttribute("data-theme");
    expect(light).toBe("light");
    expect(dark).toBe("dark");
    expect(light).not.toBe(dark);
  });
});

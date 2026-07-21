// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  isFirstLaunch,
  markFirstLaunchDone,
  readBoolFlag,
  writeBoolFlag,
} from "./first-launch";

function createLocalStorageMock(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("first-launch flags", () => {
  beforeEach(() => {
    const localStorage = createLocalStorageMock();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorage,
    });
  });

  it("readBoolFlag returns fallback for missing/unknown values", () => {
    expect(readBoolFlag("missing", true)).toBe(true);
    expect(readBoolFlag("missing", false)).toBe(false);
    window.localStorage.setItem("k", "maybe");
    expect(readBoolFlag("k", false)).toBe(false);
  });

  it("readBoolFlag accepts true/1 and false/0", () => {
    window.localStorage.setItem("t1", "true");
    window.localStorage.setItem("t2", "1");
    window.localStorage.setItem("f1", "false");
    window.localStorage.setItem("f2", "0");
    expect(readBoolFlag("t1", false)).toBe(true);
    expect(readBoolFlag("t2", false)).toBe(true);
    expect(readBoolFlag("f1", true)).toBe(false);
    expect(readBoolFlag("f2", true)).toBe(false);
  });

  it("writeBoolFlag persists string true/false", () => {
    writeBoolFlag("flag", true);
    expect(window.localStorage.getItem("flag")).toBe("true");
    writeBoolFlag("flag", false);
    expect(window.localStorage.getItem("flag")).toBe("false");
  });

  it("isFirstLaunch is true until markFirstLaunchDone", () => {
    expect(isFirstLaunch()).toBe(true);
    markFirstLaunchDone();
    expect(isFirstLaunch()).toBe(false);
    markFirstLaunchDone();
    expect(isFirstLaunch()).toBe(false);
  });

  it("swallows localStorage write failures", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("quota");
        },
      },
    });
    expect(() => writeBoolFlag("x", true)).not.toThrow();
    expect(readBoolFlag("x", true)).toBe(true);
  });

  it("falls back when localStorage is unavailable", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: undefined,
    });
    expect(readBoolFlag("x", true)).toBe(true);
    expect(() => writeBoolFlag("x", false)).not.toThrow();
    expect(isFirstLaunch()).toBe(true);
  });
});

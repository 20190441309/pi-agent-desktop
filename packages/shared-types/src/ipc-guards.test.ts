import { describe, expect, it } from "vitest";
import {
  SETTINGS_WINDOW_TABS,
  ipcError,
  isIpcError,
  isSettingsWindowTab,
} from "./index";

describe("isSettingsWindowTab", () => {
  it("accepts every SETTINGS_WINDOW_TABS entry", () => {
    for (const tab of SETTINGS_WINDOW_TABS) {
      expect(isSettingsWindowTab(tab)).toBe(true);
    }
  });

  it("rejects unknown / non-string values", () => {
    expect(isSettingsWindowTab("models")).toBe(false);
    expect(isSettingsWindowTab("")).toBe(false);
    expect(isSettingsWindowTab(null)).toBe(false);
    expect(isSettingsWindowTab(1)).toBe(false);
    expect(isSettingsWindowTab(undefined)).toBe(false);
  });
});

describe("ipcError / isIpcError", () => {
  it("brands factory results and type-guards them", () => {
    const err = ipcError("code.x", "fallback", { a: 1 });
    expect(err).toEqual({
      __brand: "IpcError",
      code: "code.x",
      fallback: "fallback",
      params: { a: 1 },
    });
    expect(isIpcError(err)).toBe(true);
  });

  it("accepts legacy shape without brand and rejects incomplete objects", () => {
    expect(isIpcError({ code: "c", fallback: "f" })).toBe(true);
    expect(isIpcError({ code: "c" })).toBe(false);
    expect(isIpcError({ fallback: "f" })).toBe(false);
    expect(isIpcError("nope")).toBe(false);
    expect(isIpcError(null)).toBe(false);
  });
});

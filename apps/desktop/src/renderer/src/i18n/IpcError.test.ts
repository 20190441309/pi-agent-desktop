import { describe, expect, it, vi } from "vitest";
import { isIpcError, translateIpcError } from "./IpcError";

describe("translateIpcError", () => {
  it("re-exports isIpcError brand detection", () => {
    expect(isIpcError({ __brand: "IpcError", code: "e", fallback: "f" })).toBe(true);
    expect(isIpcError({ code: "e", fallback: "f" })).toBe(true);
    expect(isIpcError(null)).toBe(false);
  });

  it("returns translated text when t resolves a non-key value", () => {
    const t = vi.fn((key: string) => (key === "err.network" ? "网络错误" : key));
    expect(
      translateIpcError({ __brand: "IpcError", code: "err.network", fallback: "network" }, t),
    ).toBe("网络错误");
    expect(t).toHaveBeenCalledWith("err.network", {});
  });

  it("falls back when the translation key is missing", () => {
    const t = (key: string) => key;
    expect(
      translateIpcError(
        { __brand: "IpcError", code: "missing.key", fallback: "中文兜底", params: { a: 1 } },
        t,
      ),
    ).toBe("中文兜底");
  });

  it("falls back when t throws", () => {
    const t = () => {
      throw new Error("i18n broken");
    };
    expect(
      translateIpcError({ __brand: "IpcError", code: "x", fallback: "safe" }, t),
    ).toBe("safe");
  });
});

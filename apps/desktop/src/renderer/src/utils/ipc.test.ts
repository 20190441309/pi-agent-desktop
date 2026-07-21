import { describe, expect, it } from "vitest";
import { partition } from "./ipc";

describe("partition", () => {
  it("returns ok data for successful IPC payloads", () => {
    expect(partition({ id: "ws-1" })).toEqual({ ok: true, data: { id: "ws-1" } });
    expect(partition(null)).toEqual({ ok: true, data: null });
    expect(partition("ready")).toEqual({ ok: true, data: "ready" });
  });

  it("returns err for IpcError-shaped values", () => {
    const err = { code: "ipcErrors.x", fallback: "失败了" };
    expect(partition(err)).toEqual({ ok: false, err });
  });

  it("returns err when branded IpcError is present", () => {
    const err = {
      __brand: "IpcError" as const,
      code: "ipcErrors.y",
      fallback: "blocked",
    };
    expect(partition(err)).toEqual({ ok: false, err });
  });
});

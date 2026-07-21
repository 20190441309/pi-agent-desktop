// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const markPausing = vi.fn();
const markPaused = vi.fn();
const addToast = vi.fn();

vi.mock("../stores/plan-store", () => ({
  usePlanStore: {
    getState: () => ({
      activeExecution: activeExecutionRef.current,
      markPausing,
      markPaused,
    }),
  },
}));

vi.mock("../stores/toast-store", () => ({
  addToast,
}));

// Mutable active execution shared with the mock above.
const activeExecutionRef: { current: { phase: string } | null } = {
  current: null,
};

describe("requestRunControlStop", () => {
  beforeEach(() => {
    vi.resetModules();
    markPausing.mockReset();
    markPaused.mockReset();
    addToast.mockReset();
    activeExecutionRef.current = null;
    vi.unstubAllGlobals();
  });

  async function load() {
    return import("./run-control");
  }

  it("returns false when window.piAPI is missing", async () => {
    vi.stubGlobal("window", {});
    const { requestRunControlStop } = await load();
    await expect(requestRunControlStop({ workspaceId: "ws-1" })).resolves.toBe(false);
  });

  it("prefers agentsAbort when agentId is provided", async () => {
    const agentsAbort = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", {
      piAPI: { agentsAbort, stop },
      dispatchEvent,
    });
    const { requestRunControlStop } = await load();
    const ok = await requestRunControlStop({
      workspaceId: "ws-1",
      agentId: "agent-1",
    });
    expect(ok).toBe(true);
    expect(agentsAbort).toHaveBeenCalledWith("agent-1");
    expect(stop).not.toHaveBeenCalled();
    expect(dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
  });

  it("falls back to workspace stop when agentsAbort fails", async () => {
    const agentsAbort = vi.fn(async () => {
      throw new Error("abort failed");
    });
    const stop = vi.fn(async () => undefined);
    vi.stubGlobal("window", {
      piAPI: { agentsAbort, stop },
      dispatchEvent: vi.fn(),
    });
    const { requestRunControlStop } = await load();
    const ok = await requestRunControlStop({
      workspaceId: "ws-1",
      agentId: "agent-1",
    });
    expect(ok).toBe(true);
    expect(stop).toHaveBeenCalledWith("ws-1");
  });

  it("marks plan pausing then paused for plan execution", async () => {
    activeExecutionRef.current = { phase: "executing" };
    const stop = vi.fn(async () => undefined);
    vi.stubGlobal("window", {
      piAPI: { stop },
      dispatchEvent: vi.fn(),
    });
    const { requestRunControlStop } = await load();
    const ok = await requestRunControlStop({
      workspaceId: "ws-1",
      runContext: "plan_execution",
      markPlanPausing: true,
    });
    expect(ok).toBe(true);
    expect(markPausing).toHaveBeenCalled();
    expect(markPaused).toHaveBeenCalled();
  });

  it("surfaces stop failures via toast and onError", async () => {
    const stop = vi.fn(async () => ({
      code: "ipcErrors.chat.stopFailed",
      fallback: "stop denied",
    }));
    const onError = vi.fn();
    vi.stubGlobal("window", {
      piAPI: { stop },
      dispatchEvent: vi.fn(),
    });
    const { requestRunControlStop } = await load();
    const ok = await requestRunControlStop({
      workspaceId: "ws-1",
      onError,
    });
    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("stop denied"));
    expect(addToast).toHaveBeenCalledWith("停止响应失败", "error");
  });

  it("uses pause toast copy when plan execution stop fails", async () => {
    activeExecutionRef.current = { phase: "executing" };
    const stop = vi.fn(async () => ({
      code: "ERR",
      fallback: "cannot stop",
    }));
    vi.stubGlobal("window", {
      piAPI: { stop },
      dispatchEvent: vi.fn(),
    });
    const { requestRunControlStop } = await load();
    const ok = await requestRunControlStop({
      workspaceId: "ws-1",
      runContext: "plan_execution",
    });
    expect(ok).toBe(false);
    expect(addToast).toHaveBeenCalledWith("暂停执行失败", "error");
  });
});

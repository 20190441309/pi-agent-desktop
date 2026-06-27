import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { usePlanStore } from "../plan-store";

if (typeof (globalThis as Record<string, unknown>).window === "undefined") {
  (globalThis as Record<string, unknown>).window = globalThis;
}

beforeEach(() => {
  usePlanStore.setState({
    enabled: false,
    activeCard: null,
    decisionRequest: null,
    renderedPlanCardIds: [],
    activeExecution: null,
    steps: [],
    status: "idle",
    lastError: null,
  });
  delete (globalThis as Record<string, unknown>).piAPI;
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).piAPI;
});

describe("setCard", () => {
  it("treats structured plan cards as authoritative even when the content looks like guidance", () => {
    usePlanStore.getState().setCard({
      id: "plan_1",
      title: "计划模式提示",
      content: "请告诉我你的目标和验收标准。",
      createdAt: Date.now(),
    });

    expect(usePlanStore.getState().activeCard).toMatchObject({
      id: "plan_1",
      title: "计划模式提示",
      content: "请告诉我你的目标和验收标准。",
    });
    expect(usePlanStore.getState().decisionRequest?.card?.id).toBe("plan_1");
    expect(usePlanStore.getState().activeExecution?.phase).toBe("awaiting_confirmation");
  });

  it("keeps the current execution phase when the same plan card is re-emitted during execution", () => {
    usePlanStore.setState({
      activeExecution: {
        activePlanId: "plan_running",
        title: "计划",
        filename: "create-plan-probe",
        sourceMessageId: "pm_existing",
        phase: "executing",
      },
      status: "executing",
      decisionRequest: null,
    });

    usePlanStore.getState().setCard({
      id: "plan_retry",
      title: "创建并验证 plan_probe.txt",
      filename: "create-plan-probe",
      content: "1. 创建文件\n2. 验证文件存在",
      createdAt: Date.now(),
    });

    expect(usePlanStore.getState().activeExecution).toMatchObject({
      activePlanId: "plan_running",
      sourceMessageId: "pm_existing",
      phase: "executing",
      filename: "create-plan-probe",
      title: "创建并验证 plan_probe.txt",
    });
    expect(usePlanStore.getState().status).toBe("executing");
  });
});

describe("setEnabled revert logic", () => {
  it("reverts to previous value on IPC failure (not !enabled)", async () => {
    expect(usePlanStore.getState().enabled).toBe(false);

    const mockPlanSetEnabled = vi.fn().mockRejectedValue(new Error("IPC error"));
    (globalThis as Record<string, unknown>).piAPI = {
      planSetEnabled: mockPlanSetEnabled,
    };

    usePlanStore.getState().setEnabled("ws-1", true);

    expect(usePlanStore.getState().enabled).toBe(true);

    await vi.waitFor(() => {
      expect(usePlanStore.getState().enabled).toBe(false);
    });

    expect(usePlanStore.getState().lastError).toBe("IPC error");
  });

  it("reverts to correct previous value when toggling from true to false", async () => {
    usePlanStore.setState({ enabled: true });

    const mockPlanSetEnabled = vi.fn().mockResolvedValue("some error");
    (globalThis as Record<string, unknown>).piAPI = {
      planSetEnabled: mockPlanSetEnabled,
    };

    usePlanStore.getState().setEnabled("ws-1", false);

    expect(usePlanStore.getState().enabled).toBe(false);

    await vi.waitFor(() => {
      expect(usePlanStore.getState().enabled).toBe(true);
    });

    expect(usePlanStore.getState().lastError).toBe("some error");
  });

  it("clears lastError on successful toggle", async () => {
    usePlanStore.setState({ lastError: "previous error" });

    const mockPlanSetEnabled = vi.fn().mockResolvedValue(undefined);
    (globalThis as Record<string, unknown>).piAPI = {
      planSetEnabled: mockPlanSetEnabled,
    };

    usePlanStore.getState().setEnabled("ws-1", true);

    expect(usePlanStore.getState().lastError).toBeNull();

    await vi.waitFor(() => {
      expect(usePlanStore.getState().enabled).toBe(true);
    });
  });

  it("clearError clears lastError", () => {
    usePlanStore.setState({ lastError: "some error" });
    expect(usePlanStore.getState().lastError).toBe("some error");

    usePlanStore.getState().clearError();
    expect(usePlanStore.getState().lastError).toBeNull();
  });

  it("sets default error message on non-Error catch", async () => {
    const mockPlanSetEnabled = vi.fn().mockRejectedValue("string error");
    (globalThis as Record<string, unknown>).piAPI = {
      planSetEnabled: mockPlanSetEnabled,
    };

    usePlanStore.getState().setEnabled("ws-1", true);

    await vi.waitFor(() => {
      expect(usePlanStore.getState().enabled).toBe(false);
    });

    expect(usePlanStore.getState().lastError).toBe("计划模式切换失败");
  });
});

describe("setProgress completion rules", () => {
  it("marks execution complete only when progress returns to idle with all steps completed", () => {
    usePlanStore.setState({
      activeExecution: {
        activePlanId: "plan_1",
        title: "执行计划",
        phase: "executing",
      },
      steps: [
        { id: "s1", text: "写入文件", status: "completed" },
        { id: "s2", text: "验证结果", status: "completed" },
      ],
      status: "executing",
    });

    usePlanStore.getState().setProgress({
      status: "idle",
      items: [],
    });

    expect(usePlanStore.getState().activeExecution?.phase).toBe("completed");
    expect(usePlanStore.getState().status).toBe("completed");
  });

  it("does not mark execution complete when idle arrives but steps are still incomplete", () => {
    usePlanStore.setState({
      activeExecution: {
        activePlanId: "plan_2",
        title: "执行计划",
        phase: "executing",
      },
      steps: [
        { id: "s1", text: "写入文件", status: "completed" },
        { id: "s2", text: "验证结果", status: "pending" },
      ],
      status: "executing",
    });

    usePlanStore.getState().setProgress({
      status: "idle",
      items: [],
    });

    expect(usePlanStore.getState().activeExecution?.phase).toBe("executing");
    expect(usePlanStore.getState().status).toBe("idle");
  });
});

describe("setAwaitingConfirmation", () => {
  it("does not reopen waiting confirmation for the same executing plan", () => {
    usePlanStore.setState({
      activeExecution: {
        activePlanId: "plan_running",
        title: "测试计划",
        filename: "create-plan-probe",
        sourceMessageId: "pm_existing",
        phase: "executing",
      },
      status: "executing",
    });

    usePlanStore.getState().setAwaitingConfirmation({
      activePlanId: "plan_retry",
      title: "创建并验证 plan_probe.txt",
      filename: "create-plan-probe",
      sourceMessageId: "pm_retry",
    });

    expect(usePlanStore.getState().activeExecution).toMatchObject({
      activePlanId: "plan_running",
      sourceMessageId: "pm_existing",
      phase: "executing",
      filename: "create-plan-probe",
      title: "创建并验证 plan_probe.txt",
    });
    expect(usePlanStore.getState().status).toBe("executing");
  });
});

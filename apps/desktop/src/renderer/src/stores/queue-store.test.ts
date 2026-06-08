import { beforeEach, describe, expect, it } from "vitest";
import { useQueueStore } from "./queue-store";

describe("queue-store", () => {
  beforeEach(() => {
    useQueueStore.getState().clear();
  });

  it("tracks running state from agent lifecycle events", () => {
    useQueueStore.getState().applyEvent({ type: "agent_start" });
    expect(useQueueStore.getState().running).toBe(true);

    useQueueStore.getState().applyEvent({ type: "agent_end" });
    expect(useQueueStore.getState().running).toBe(false);
  });

  it("stores steering and follow-up queues from queue_update", () => {
    useQueueStore.getState().applyEvent({
      type: "queue_update",
      steering: ["adjust plan"],
      followUp: ["run tests"],
    });

    expect(useQueueStore.getState().steering).toEqual(["adjust plan"]);
    expect(useQueueStore.getState().followUp).toEqual(["run tests"]);
    expect(useQueueStore.getState().items.map((item) => [item.label, item.status])).toEqual([
      ["adjust plan", "waiting"],
      ["run tests", "pending"],
    ]);
    expect(useQueueStore.getState().updatedAt).toEqual(expect.any(Number));
  });

  it("marks errors as not running without clearing queue details", () => {
    useQueueStore.getState().applyEvent({
      type: "queue_update",
      steering: ["keep context"],
      followUp: [],
    });
    useQueueStore.getState().applyEvent({ type: "agent_start" });
    useQueueStore.getState().applyEvent({ type: "extension_error", message: "tool crashed" } as never);

    expect(useQueueStore.getState().running).toBe(false);
    expect(useQueueStore.getState().steering).toEqual(["keep context"]);
    expect(useQueueStore.getState().lastError).toBe("tool crashed");
  });

  it("records the latest completion time from agent lifecycle events", () => {
    useQueueStore.getState().applyEvent({ type: "agent_start" });
    useQueueStore.getState().applyEvent({ type: "agent_end" });

    expect(useQueueStore.getState().running).toBe(false);
    expect(useQueueStore.getState().lastCompletedAt).toEqual(expect.any(Number));
    expect(useQueueStore.getState().lastError).toBeNull();
    expect(useQueueStore.getState().items[0]).toMatchObject({
      id: "queue:running",
      label: "当前任务已完成",
      status: "completed",
    });
  });

  it("tracks auto retry lifecycle as running activity", () => {
    useQueueStore.getState().applyEvent({ type: "auto_retry_start" });

    expect(useQueueStore.getState().running).toBe(true);
    expect(useQueueStore.getState().autoRetrying).toBe(true);
    expect(useQueueStore.getState().lastActivity).toBe("自动重试中");

    useQueueStore.getState().applyEvent({ type: "auto_retry_end" });

    expect(useQueueStore.getState().autoRetrying).toBe(false);
    expect(useQueueStore.getState().lastActivity).toBe("自动重试结束");
  });

  it("records tool execution activity and visible tool errors", () => {
    useQueueStore.getState().applyEvent({
      type: "tool_execution_start",
      toolCallId: "tc1",
      toolName: "bash",
      args: { command: "pnpm test" },
    });

    expect(useQueueStore.getState().running).toBe(true);
    expect(useQueueStore.getState().lastActivity).toBe("bash 运行中");

    useQueueStore.getState().applyEvent({
      type: "tool_execution_end",
      toolCallId: "tc1",
      toolName: "bash",
      isError: true,
    });

    expect(useQueueStore.getState().lastActivity).toBe("bash 失败");
    expect(useQueueStore.getState().lastError).toBe("bash 执行失败");
    expect(useQueueStore.getState().items[0]).toMatchObject({
      id: "tool:tc1",
      label: "bash 失败",
      status: "error",
    });
  });

  it("keeps completed and queued task items without stale queue duplicates", () => {
    useQueueStore.getState().applyEvent({ type: "agent_start" });
    useQueueStore.getState().applyEvent({
      type: "queue_update",
      steering: ["first steer"],
      followUp: ["first follow"],
    });
    useQueueStore.getState().applyEvent({
      type: "queue_update",
      steering: ["second steer"],
      followUp: [],
    });

    const labels = useQueueStore.getState().items.map((item) => item.label);
    expect(labels).toContain("当前任务运行中");
    expect(labels).toContain("second steer");
    expect(labels).not.toContain("first steer");
    expect(labels).not.toContain("first follow");
  });
});

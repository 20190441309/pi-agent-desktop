import { isIpcError } from "@shared";
import { usePlanStore } from "../stores/plan-store";
import { addToast } from "../stores/toast-store";

interface RequestRunControlStopInput {
  workspaceId?: string | null;
  agentId?: string | null;
  runContext?: "task" | "plan_execution";
  markPlanPausing?: boolean;
  onError?: (message: string) => void;
}

function normalizeRunControlError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "未知错误";
}

async function stopWorkspaceRun(workspaceId: string): Promise<void> {
  if (!window.piAPI?.stop) {
    throw new Error("stop IPC 不可用");
  }
  const result = await window.piAPI.stop(workspaceId);
  if (isIpcError(result)) {
    throw new Error(result.fallback);
  }
}

export async function requestRunControlStop(input: RequestRunControlStopInput): Promise<boolean> {
  if (!window.piAPI) return false;

  const planStore = usePlanStore.getState();
  const isPlanExecution = input.runContext === "plan_execution"
    || planStore.activeExecution?.phase === "executing"
    || planStore.activeExecution?.phase === "pausing";

  if (isPlanExecution && input.markPlanPausing && planStore.activeExecution?.phase === "executing") {
    planStore.markPausing();
  }

  let stopError: string | null = null;
  let stopped = false;

  if (input.agentId && window.piAPI.agentsAbort) {
    try {
      await window.piAPI.agentsAbort(input.agentId);
      stopped = true;
    } catch (error) {
      stopError = normalizeRunControlError(error);
    }
  }

  if (!stopped && input.workspaceId) {
    try {
      await stopWorkspaceRun(input.workspaceId);
      stopped = true;
      stopError = null;
    } catch (error) {
      const workspaceStopError = normalizeRunControlError(error);
      stopError = stopError ? `${workspaceStopError} (agentsAbort: ${stopError})` : workspaceStopError;
    }
  }

  if (!stopped) {
    if (!stopError) return false;
    const message = `停止失败: ${stopError}`;
    input.onError?.(message);
    addToast(isPlanExecution ? "暂停执行失败" : "停止响应失败", "error");
    return false;
  }

  if (isPlanExecution && usePlanStore.getState().activeExecution) {
    usePlanStore.getState().markPaused();
  }
  window.dispatchEvent(new CustomEvent("pi:stream-end"));
  return true;
}

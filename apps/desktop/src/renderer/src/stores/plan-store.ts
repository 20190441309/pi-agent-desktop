import { create } from "zustand";
import type { GoalState, PlanCard, PlanDecisionRequest, PlanProgressItem, PlanProgressUpdate } from "@shared";
import { isIpcError } from "@shared";
import { createSubscriptionManager } from "../utils/subscription-manager";

export type PlanFlowPhase =
  | "idle"
  | "planning"
  | "awaiting_confirmation"
  | "executing"
  | "pausing"
  | "paused"
  | "completed"
  | "failed";

export interface ActivePlanExecution {
  activePlanId: string;
  title: string;
  filename?: string;
  sourceMessageId?: string;
  executionMessageId?: string;
  phase: PlanFlowPhase;
}

interface PlanState {
  enabled: boolean;
  workspaceId: string | null;
  activeCard: PlanCard | null;
  decisionRequest: PlanDecisionRequest | null;
  pendingPlanClarification: { workspaceId: string; originalContent: string } | null;
  renderedPlanCardIds: string[];
  activeExecution: ActivePlanExecution | null;
  goal: GoalState | null;
  steps: PlanProgressItem[];
  status: PlanProgressUpdate["status"];
  lastError: string | null;
  clearError: () => void;
  setEnabled: (workspaceId: string | undefined, enabled: boolean) => void;
  setCard: (card: PlanCard) => void;
  setDecisionRequest: (request: PlanDecisionRequest | null) => void;
  setPendingPlanClarification: (request: { workspaceId: string; originalContent: string } | null) => void;
  markPlanCardRendered: (cardId: string) => void;
  startPlanning: () => void;
  setAwaitingConfirmation: (input: { activePlanId: string; title: string; filename?: string; sourceMessageId?: string }) => void;
  startExecution: (input: { activePlanId: string; title: string; filename?: string; sourceMessageId?: string; executionMessageId?: string }) => void;
  setExecutionMessageId: (messageId: string) => void;
  markPausing: () => void;
  markPaused: () => void;
  markCompleted: () => void;
  markFailed: () => void;
  cancel: () => void;
  clearPlanFlow: () => void;
  setProgress: (update: PlanProgressUpdate) => void;
  setGoal: (goal: GoalState | null) => void;
  reset: () => void;
}

function stepsFromMarkdown(content: string): PlanProgressItem[] {
  const matches: Array<PlanProgressItem | null> = content
    .split(/\r?\n/)
    .map((line, index) => {
      const task = line.match(/^\s*(?:(?:[-*]|\d+\.)\s+|(?:步骤|Step)\s*\d+\s*[：:.]\s*)(?:\[[ xX]\]\s*)?(.+)/i);
      if (!task) return null;
      const done = /\[[xX]\]|\[DONE:\d+\]/.test(line);
      return {
        id: `plan_md_${index}`,
        text: task[1].trim(),
        status: done ? "completed" : "pending",
      } satisfies PlanProgressItem;
    });
  return matches.filter((item): item is PlanProgressItem => item !== null).slice(0, 12);
}

function stripInlineThinking(content: string): string {
  return content
    .replace(/<think[\s\S]*?<\/think>/gi, "")
    .replace(/<think[\s\S]*$/gi, "")
    .trim();
}

function normalizePlanIdentity(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

function samePlanIdentity(
  left: { title?: string; filename?: string },
  right: { title?: string; filename?: string },
): boolean {
  const leftFilename = normalizePlanIdentity(left.filename);
  const rightFilename = normalizePlanIdentity(right.filename);
  if (leftFilename && rightFilename) {
    return leftFilename === rightFilename;
  }
  const leftTitle = normalizePlanIdentity(left.title);
  const rightTitle = normalizePlanIdentity(right.title);
  return Boolean(leftTitle && rightTitle && leftTitle === rightTitle);
}

function shouldPreservePlanExecution(
  activeExecution: ActivePlanExecution | null,
  incoming: { title?: string; filename?: string },
): activeExecution is ActivePlanExecution {
  if (!activeExecution) return false;
  if (!samePlanIdentity(activeExecution, incoming)) return false;
  return (
    activeExecution.phase === "executing"
    || activeExecution.phase === "pausing"
    || activeExecution.phase === "paused"
    || activeExecution.phase === "completed"
  );
}

/**
 * 推导 plan 文件 slug: 仅保留 [a-z0-9-] (中文降级为 -), 最长 50 字符.
 * 真正的 sanitize 由 main 进程的 PlanFileService.sanitizeSlug 兜底; 这里只是 best-effort.
 */
function deriveSlug(title: string): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return sanitized || "plan";
}

/** 把 unknown (Error / string / IpcError reject 等) 转成可展示的 lastError 文本. */
function describeError(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err || fallback;
  return fallback;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  enabled: false,
  workspaceId: null,
  activeCard: null,
  decisionRequest: null,
  pendingPlanClarification: null,
  renderedPlanCardIds: [],
  activeExecution: null,
  goal: null,
  steps: [],
  status: "idle",
  lastError: null,
  clearError: () => set({ lastError: null }),

  setEnabled: (workspaceId, enabled) => {
    const previousEnabled = get().enabled;
    set({
      enabled,
      lastError: null,
      ...(workspaceId ? { workspaceId } : {}),
      ...(enabled ? {} : { pendingPlanClarification: null }),
    });
    if (workspaceId && window.piAPI?.planSetEnabled) {
      const result = window.piAPI.planSetEnabled(workspaceId, enabled);
      if (result && typeof result.then === "function") {
        result.then((res) => {
          if (res !== undefined) {
            set({ enabled: previousEnabled, lastError: typeof res === 'string' ? res : '计划模式切换失败' });
          }
        }).catch((err) => {
          set({ enabled: previousEnabled, lastError: err instanceof Error ? err.message : '计划模式切换失败' });
        });
      }
    }
  },

  setCard: (card) => {
    const cleanCard = {
      ...card,
      content: stripInlineThinking(card.content),
    };

    const previousSnapshot = {
      activeCard: get().activeCard,
      steps: get().steps,
      status: get().status,
      activeExecution: get().activeExecution,
      decisionRequest: get().decisionRequest,
    };

    const preserveExecution = shouldPreservePlanExecution(get().activeExecution, cleanCard);
    const resolvedFilename = preserveExecution
      ? (cleanCard.filename ?? get().activeExecution?.filename ?? undefined)
      : cleanCard.filename;
    const existingFilename = resolvedFilename?.trim() || undefined;

    set((state) => ({
      activeCard: cleanCard,
      steps: stepsFromMarkdown(cleanCard.content),
      status: shouldPreservePlanExecution(state.activeExecution, cleanCard) ? state.status : "waiting_decision",
      activeExecution: shouldPreservePlanExecution(state.activeExecution, cleanCard)
        ? {
            ...state.activeExecution,
            title: cleanCard.title,
            filename: cleanCard.filename ?? state.activeExecution.filename,
          }
        : {
            activePlanId: cleanCard.id,
            title: cleanCard.title,
            filename: cleanCard.filename,
            phase: "awaiting_confirmation",
          },
      decisionRequest: shouldPreservePlanExecution(state.activeExecution, cleanCard)
        ? state.decisionRequest
        : state.decisionRequest && !state.decisionRequest.card
          ? state.decisionRequest
          : {
              requestId: `plan_decision_${cleanCard.id}`,
              card: cleanCard,
              source: "plan",
              createdAt: Date.now(),
            },
    }));

    // IPC persistence — see SubTasks 5.1 / 5.5
    const wsId = get().workspaceId;
    if (!wsId) return;
    if (existingFilename) {
      if (!window.piAPI?.planUpdate) return;
      window.piAPI.planUpdate(wsId, existingFilename, { content: cleanCard.content })
        .then((res) => {
          if (isIpcError(res)) {
            set({ ...previousSnapshot, lastError: res.fallback });
          }
        })
        .catch((err) => {
          set({ ...previousSnapshot, lastError: describeError(err, "Plan 文件更新失败") });
        });
    } else {
      if (!window.piAPI?.planCreate) return;
      const slug = deriveSlug(cleanCard.title);
      window.piAPI.planCreate(wsId, { slug, title: cleanCard.title, content: cleanCard.content })
        .then((res) => {
          if (isIpcError(res)) {
            set({ ...previousSnapshot, lastError: res.fallback });
            return;
          }
          set((s) => ({
            activeExecution: s.activeExecution
              ? { ...s.activeExecution, filename: res.filename }
              : s.activeExecution,
          }));
        })
        .catch((err) => {
          set({ ...previousSnapshot, lastError: describeError(err, "Plan 文件创建失败") });
        });
    }
  },

  setDecisionRequest: (request) => set({ decisionRequest: request }),

  setPendingPlanClarification: (request) => set({ pendingPlanClarification: request }),

  markPlanCardRendered: (cardId) => set((state) => ({
    renderedPlanCardIds: state.renderedPlanCardIds.includes(cardId)
      ? state.renderedPlanCardIds
      : [...state.renderedPlanCardIds, cardId],
  })),

  startPlanning: () => set({
    activeExecution: null,
    status: "idle",
  }),

  setAwaitingConfirmation: (input) => set((state) => (
    shouldPreservePlanExecution(state.activeExecution, input)
      ? {
          activeExecution: state.activeExecution
            ? {
                ...state.activeExecution,
                title: input.title,
                filename: input.filename ?? state.activeExecution.filename,
                sourceMessageId: state.activeExecution.sourceMessageId ?? input.sourceMessageId,
              }
            : null,
          status: state.status,
        }
      : {
          activeExecution: {
            ...(state.activeExecution ?? {}),
            activePlanId: input.activePlanId,
            title: input.title,
            filename: input.filename,
            sourceMessageId: input.sourceMessageId,
            phase: "awaiting_confirmation",
          },
          status: "waiting_decision",
        }
  )),

  startExecution: (input) => {
    const previousSnapshot = {
      activeExecution: get().activeExecution,
      status: get().status,
    };
    const filename = input.filename?.trim() || previousSnapshot.activeExecution?.filename?.trim() || undefined;

    set({
      activeExecution: {
        activePlanId: input.activePlanId,
        title: input.title,
        filename: input.filename,
        sourceMessageId: input.sourceMessageId,
        executionMessageId: input.executionMessageId,
        phase: "executing",
      },
      status: "executing",
    });

    // IPC persistence — SubTask 5.2
    const wsId = get().workspaceId;
    if (!wsId || !filename || !window.piAPI?.planUpdate) return;
    window.piAPI.planUpdate(wsId, filename, { status: "executing" })
      .then((res) => {
        if (isIpcError(res)) {
          set({ ...previousSnapshot, lastError: res.fallback });
        }
      })
      .catch((err) => {
        set({ ...previousSnapshot, lastError: describeError(err, "Plan 状态更新失败") });
      });
  },

  setExecutionMessageId: (messageId) => set((state) => ({
    activeExecution: state.activeExecution
      ? { ...state.activeExecution, executionMessageId: messageId }
      : null,
  })),

  markPausing: () => set((state) => ({
    activeExecution: state.activeExecution
      ? { ...state.activeExecution, phase: "pausing" }
      : null,
    status: "executing",
  })),

  markPaused: () => set((state) => ({
    activeExecution: state.activeExecution
      ? { ...state.activeExecution, phase: "paused" }
      : null,
    status: "waiting_decision",
  })),

  markCompleted: () => {
    const previousSnapshot = {
      activeExecution: get().activeExecution,
      status: get().status,
      steps: get().steps,
    };
    const filename = previousSnapshot.activeExecution?.filename?.trim() || undefined;

    set((state) => ({
      activeExecution: state.activeExecution
        ? { ...state.activeExecution, phase: "completed" }
        : null,
      status: "completed",
      steps: state.steps.map((step) => (
        step.status === "failed"
          ? step
          : { ...step, status: "completed" }
      )),
    }));

    // IPC persistence — SubTask 5.3 (skip when filename missing, still update local state)
    const wsId = get().workspaceId;
    if (!wsId || !filename || !window.piAPI?.planComplete) return;
    window.piAPI.planComplete(wsId, filename)
      .then((res) => {
        if (isIpcError(res)) {
          set({ ...previousSnapshot, lastError: res.fallback });
        }
      })
      .catch((err) => {
        set({ ...previousSnapshot, lastError: describeError(err, "Plan 完成失败") });
      });
  },

  markFailed: () => set((state) => ({
    activeExecution: state.activeExecution
      ? { ...state.activeExecution, phase: "failed" }
      : null,
    status: "idle",
  })),

  cancel: () => {
    const previousSnapshot = {
      activeCard: get().activeCard,
      decisionRequest: get().decisionRequest,
      pendingPlanClarification: get().pendingPlanClarification,
      activeExecution: get().activeExecution,
      steps: get().steps,
      status: get().status,
    };
    const filename = previousSnapshot.activeExecution?.filename?.trim() || undefined;

    // Optimistically clear local state (mirrors clearPlanFlow).
    set({
      activeCard: null,
      decisionRequest: null,
      pendingPlanClarification: null,
      activeExecution: null,
      steps: [],
      status: "idle",
    });

    // IPC persistence — SubTask 5.4 (skip when filename missing)
    const wsId = get().workspaceId;
    if (!wsId || !filename || !window.piAPI?.planDelete) return;
    window.piAPI.planDelete(wsId, filename)
      .then((res) => {
        if (isIpcError(res)) {
          set({ ...previousSnapshot, lastError: res.fallback });
        }
      })
      .catch((err) => {
        set({ ...previousSnapshot, lastError: describeError(err, "Plan 取消失败") });
      });
  },

  clearPlanFlow: () => set({
    activeCard: null,
    decisionRequest: null,
    pendingPlanClarification: null,
    activeExecution: null,
    steps: [],
    status: "idle",
  }),

  setProgress: (update) => {
    const current = get();
    const nextSteps = update.items.length > 0 ? update.items : current.steps;
    const isCompletedSignal = update.status === "completed"
      || (
        update.status === "idle"
        && current.activeExecution?.phase === "executing"
        && nextSteps.length > 0
        && nextSteps.every((item) => item.status === "completed")
      );
    set({
      steps: nextSteps,
      status: isCompletedSignal ? "completed" : (update.status ?? current.status),
      activeExecution: isCompletedSignal && current.activeExecution
        ? { ...current.activeExecution, phase: "completed" }
        : current.activeExecution,
    });
  },

  setGoal: (goal) => set({ goal: goal?.status === "cleared" ? null : goal }),

  reset: () => set({ activeCard: null, decisionRequest: null, pendingPlanClarification: null, renderedPlanCardIds: [], activeExecution: null, goal: null, steps: [], status: "idle" }),
}));

const { ensure, cleanup } = createSubscriptionManager();

export function ensurePlanSubscriptions(): void {
  if (!window.piAPI?.onPlanCard) return;
  ensure(() => {
    const offs: Array<() => void> = [
      window.piAPI!.onPlanCard((card) => usePlanStore.getState().setCard(card)),
      window.piAPI!.onPlanDecisionRequest((request) => usePlanStore.getState().setDecisionRequest(request)),
      window.piAPI!.onPlanProgress((update) => usePlanStore.getState().setProgress(update)),
    ];
    const offGoal = window.piAPI!.onGoalChanged?.((goal) => usePlanStore.getState().setGoal(goal));
    if (typeof offGoal === "function") offs.push(offGoal);
    return offs;
  });
}

/** 退订所有 plan 订阅, 供测试 / AppShell 重挂时重置. */
export function cleanupPlanSubscriptions(): void {
  cleanup();
}

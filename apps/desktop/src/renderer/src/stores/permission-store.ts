import { create } from "zustand";
import type { ExtensionUiRequest, PermissionDecision, PermissionMode } from "@shared";
import { logger } from "../utils/logger";

interface PermissionState {
  mode: PermissionMode;
  pending: ExtensionUiRequest[];
  setMode: (mode: PermissionMode) => void;
  enqueue: (request: ExtensionUiRequest) => void;
  respond: (requestId: string, decision: PermissionDecision) => void;
  dismiss: (requestId: string) => void;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  mode: "smart",
  pending: [],

  setMode: (mode) => {
    set({ mode });
    window.piAPI?.permissionSetMode(mode).catch((err) => {
      logger.error("[permission-store] set mode failed:", err);
    });
  },

  enqueue: (request) => {
    set((state) => ({
      pending: state.pending.some((item) => item.requestId === request.requestId)
        ? state.pending
        : [...state.pending, request],
    }));
  },

  respond: (requestId, decision) => {
    const request = get().pending.find((item) => item.requestId === requestId);
    if (!request) return;
    // permissionRespond 内部用 ipcRenderer.send (fire-and-forget), 但 send 可能因
    // webContents 已销毁等同步抛错; 包 try/catch 避免静默丢失 + 记录失败.
    try {
      window.piAPI?.permissionRespond(requestId, { requestId, decision });
    } catch (err) {
      logger.error("[permission-store] respond failed:", err);
    }
    get().dismiss(requestId);
  },

  dismiss: (requestId) => {
    set((state) => ({ pending: state.pending.filter((item) => item.requestId !== requestId) }));
  },
}));

let subscribed = false;
let unsubscribe: (() => void) | null = null;

export function ensurePermissionSubscriptions(): void {
  if (subscribed || !window.piAPI?.onPermissionRequest) return;
  subscribed = true;
  const off = window.piAPI.onPermissionRequest((request) => {
    usePermissionStore.getState().enqueue(request);
  });
  // onPermissionRequest 可能返回 unsubscribe 函数; 否则仅记录用于测试期重置
  if (typeof off === "function") unsubscribe = off;
}

/** 退订 onPermissionRequest, 供测试 / AppShell 重挂时重置 (生产环境通常不需调用). */
export function cleanupPermissionSubscriptions(): void {
  try {
    unsubscribe?.();
  } catch {
    // ignore
  }
  unsubscribe = null;
  subscribed = false;
}

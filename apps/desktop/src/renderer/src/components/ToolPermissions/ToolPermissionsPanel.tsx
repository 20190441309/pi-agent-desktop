import React, { useEffect, useRef, useState } from "react";
import { isIpcError, type ToolPermissionKey, type ToolPermissions, type ToolPermissionPreset } from "@shared";
import { TOOL_PERMISSION_PRESETS, useSettingsStore } from "../../stores/settings-store";
import { useSessionStore } from "../../stores/session-store";

interface ToolPermissionsPanelProps {
  workspaceId?: string | null;
}

const TOOL_LABELS: Array<{ key: ToolPermissionKey; label: string }> = [
  { key: "fileRead", label: "文件读取" },
  { key: "fileWrite", label: "文件写入" },
  { key: "shell", label: "Bash / PowerShell" },
  { key: "git", label: "Git" },
  { key: "network", label: "网络" },
  { key: "extensions", label: "扩展工具" },
];

const PRESETS: Array<{ id: ToolPermissionPreset; label: string }> = [
  { id: "minimal", label: "最小权限" },
  { id: "development", label: "开发常用" },
  { id: "all", label: "全部开启" },
];

function formatWriteError(error: unknown): string {
  if (isIpcError(error)) return error.fallback;
  return String(error);
}

export function describeToolPermissions(permissions: ToolPermissions): string {
  const disabled = TOOL_LABELS.filter((item) => !permissions[item.key]).map((item) => item.label);
  if (disabled.length === 0) return "工具权限：全部开启。";
  return `工具权限：已禁用 ${disabled.join("、")}。若需要这些能力，请先请求用户开启。`;
}

export function ToolPermissionsPanel({ workspaceId }: ToolPermissionsPanelProps): React.JSX.Element {
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const pendingSessionPersistCount = useRef<number | null>(null);
  const currentSession = useSessionStore((state) =>
    state.currentSessionId
      ? state.sessions.find((session) => session.id === state.currentSessionId) ?? null
      : null,
  );
  const workspaceDefaults = useSettingsStore((state) =>
    workspaceId
      ? state.settings.workspaceToolDefaults?.[workspaceId] ?? TOOL_PERMISSION_PRESETS.development
      : TOOL_PERMISSION_PRESETS.development,
  );
  const updateWorkspaceToolDefaults = useSettingsStore((state) => state.updateWorkspaceToolDefaults);
  const clearWriteError = useSettingsStore((state) => state.clearWriteError);
  const settingsWriteError = useSettingsStore((state) => state.lastWriteError);
  const updateSessionToolPermissions = useSessionStore((state) => state.updateSessionToolPermissions);
  const persistErrorCount = useSessionStore((state) => state.persistErrorCount);
  const lastPersistError = useSessionStore((state) => state.lastPersistError);

  const effective = currentSession?.toolPermissions ?? workspaceDefaults;
  const canApply = Boolean(currentSession || workspaceId);

  useEffect(() => {
    if (settingsWriteError) {
      setStatus({ type: "error", message: `工具权限保存失败：${formatWriteError(settingsWriteError)}` });
    }
  }, [settingsWriteError]);

  useEffect(() => {
    if (pendingSessionPersistCount.current == null) return;
    if (persistErrorCount <= pendingSessionPersistCount.current) return;
    setStatus({
      type: "error",
      message: `工具权限已应用到当前会话，但保存失败：${lastPersistError ?? "未知错误"}`,
    });
    pendingSessionPersistCount.current = null;
  }, [lastPersistError, persistErrorCount]);

  const applyPermissions = (next: ToolPermissions): void => {
    if (!canApply) {
      setStatus({ type: "error", message: "请先选择工作区或打开会话后再修改工具权限。" });
      return;
    }
    if (currentSession) {
      pendingSessionPersistCount.current = persistErrorCount;
      updateSessionToolPermissions(currentSession.id, next);
      setStatus({ type: "success", message: "已应用到当前会话，正在后台保存。" });
      return;
    }
    if (workspaceId) {
      clearWriteError();
      updateWorkspaceToolDefaults(workspaceId, next);
      setStatus({ type: "success", message: "已更新工作区默认权限。" });
    }
  };

  return (
    <section className="rounded-[14px] border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-[13px] font-medium">工具权限</h2>
        <span className="text-[10px] text-[var(--mm-text-tertiary)]">
          {currentSession ? "Session" : "Workspace"}
        </span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={!canApply}
            onClick={() => applyPermissions(TOOL_PERMISSION_PRESETS[preset.id])}
            className="rounded-md border border-[var(--mm-border)] px-2 py-1 text-[11px] text-[var(--mm-text-secondary)] hover:bg-[var(--mm-bg-hover)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {TOOL_LABELS.map((item) => (
          <label
            key={item.key}
            className={`flex min-h-8 items-center justify-between gap-2 rounded-md px-2 text-xs transition-colors ${
              canApply ? "cursor-pointer hover:bg-[var(--mm-bg-hover)]" : "cursor-not-allowed opacity-60"
            }`}
          >
            <span>{item.label}</span>
            <input
              type="checkbox"
              checked={effective[item.key]}
              disabled={!canApply}
              onChange={(event) => applyPermissions({ ...effective, [item.key]: event.target.checked })}
              className="h-4 w-4 accent-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-45"
            />
          </label>
        ))}
      </div>
      {!canApply && !status ? (
        <div className="mt-3 rounded-md border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--mm-text-tertiary)]" role="status">
          选择工作区后可配置默认工具权限。
        </div>
      ) : null}
      {status ? (
        <div
          role={status.type === "error" ? "alert" : "status"}
          className={`mt-3 rounded-md border px-2.5 py-2 text-[11px] leading-relaxed ${
            status.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-[var(--mm-border)] bg-[var(--mm-bg-sidebar)] text-[var(--mm-text-secondary)]"
          }`}
        >
          {status.message}
        </div>
      ) : null}
    </section>
  );
}

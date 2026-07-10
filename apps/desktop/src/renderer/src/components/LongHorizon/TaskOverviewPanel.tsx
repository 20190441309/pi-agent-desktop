import React, { useMemo } from "react";
import { useTaskProgress } from "../../hooks/useTaskProgress";
import { usePlanStore } from "../../stores/plan-store";
import { useRuntimeFeatureStore, isRuntimeFeatureEnabled } from "../../stores/runtime-feature-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useWorkspaceStore } from "../../stores/workspace-store";
import { useSessionStore } from "../../stores/session-store";
import { useAgentStore } from "../../stores/agent-store";
import { useI18n } from "../../i18n";

export function TaskOverviewPanel(): React.JSX.Element {
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const currentAgentId = useAgentStore((state) => state.currentAgentId);
  const agents = useAgentStore((state) => state.agents);
  const goal = usePlanStore((state) => state.goal);
  const featureState = useRuntimeFeatureStore((state) => state.featureState);
  const longHorizon = useSettingsStore((state) => state.settings.longHorizon);
  const currentWorkspace = useWorkspaceStore((state) => state.getCurrentWorkspace());
  const { t } = useI18n();
  const scopedAgentId = useMemo(() => {
    if (!currentWorkspace) return undefined;
    if (currentSessionId) {
      const sessionAgent = agents.find((agent) => agent.workspaceId === currentWorkspace.id && agent.sessionId === currentSessionId);
      if (sessionAgent) return sessionAgent.id;
    }
    const selectedAgent = currentAgentId
      ? agents.find((agent) => agent.id === currentAgentId && agent.workspaceId === currentWorkspace.id)
      : undefined;
    return selectedAgent?.id ?? agents.find((agent) => agent.workspaceId === currentWorkspace.id && !agent.sessionId)?.id;
  }, [agents, currentAgentId, currentSessionId, currentWorkspace]);
  const { tasks } = useTaskProgress(scopedAgentId);
  const taskEnabled = isRuntimeFeatureEnabled(featureState, longHorizon, "task");

  const statusLabel = (status: "pending" | "running" | "completed" | "failed"): string => {
    switch (status) {
      case "running":
        return t("taskOverview.status.running");
      case "completed":
        return t("taskOverview.status.completed");
      case "failed":
        return t("taskOverview.status.failed");
      case "pending":
      default:
        return t("taskOverview.status.pending");
    }
  };

  return (
    <section className="flex h-full flex-col overflow-hidden bg-[var(--mm-bg-body)] px-6 py-6">
      <div className="mb-5">
        <h1 className="m-0 text-xl font-semibold text-[var(--mm-text-primary)]">{t("taskOverview.title")}</h1>
        <p className="mt-1 text-sm text-[var(--mm-text-secondary)]">
          {currentWorkspace
            ? t("taskOverview.subtitle.currentWorkspace", { name: currentWorkspace.name })
            : t("taskOverview.subtitle.selectWorkspace")}
        </p>
      </div>

      {!taskEnabled ? (
        <div className="rounded-2xl border border-dashed border-[var(--mm-border)] bg-[var(--mm-bg-panel)] px-4 py-5 text-sm text-[var(--mm-text-secondary)]">
          {t("taskOverview.disabled")}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-2xl border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="m-0 text-sm font-medium text-[var(--mm-text-primary)]">{t("taskOverview.taskList.heading")}</h2>
              <span className="rounded-full bg-[var(--mm-bg-sidebar)] px-2 py-0.5 text-[11px] text-[var(--mm-text-tertiary)]">
                {t("taskOverview.taskList.countSuffix", { count: tasks.length })}
              </span>
            </div>
            {tasks.length === 0 ? (
              <p className="m-0 text-sm text-[var(--mm-text-secondary)]">{t("taskOverview.taskList.empty")}</p>
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="rounded-xl border border-[var(--mm-border)] bg-[var(--mm-bg-sidebar)] px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-[var(--mm-text-primary)]">{task.name}</span>
                      <span className="shrink-0 text-xs text-[var(--mm-text-tertiary)]">{statusLabel(task.status)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="rounded-2xl border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] p-4">
            <h2 className="m-0 text-sm font-medium text-[var(--mm-text-primary)]">{t("taskOverview.goal.heading")}</h2>
            {goal ? (
              <div className="mt-3 space-y-2">
                <p className="m-0 text-sm text-[var(--mm-text-primary)]">{goal.condition}</p>
                <p className="m-0 text-xs text-[var(--mm-text-tertiary)]">{t("taskOverview.goal.status", { status: goal.status })}</p>
                {goal.reason && <p className="m-0 text-xs text-[var(--mm-text-secondary)]">{goal.reason}</p>}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--mm-text-secondary)]">{t("taskOverview.goal.empty")}</p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

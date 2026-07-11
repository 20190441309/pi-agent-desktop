import React, { lazy, Suspense, useEffect, useState } from "react";
import type { TerminalCommandMode } from "../../utils/terminal-command";
import { useI18n } from "../../i18n";
import { GitPanel } from "../GitPanel/GitPanel";

const FileWorkspace = lazy(() =>
  import("../FileWorkspace/FileWorkspace").then((module) => ({ default: module.FileWorkspace })),
);
const TerminalPanel = lazy(() =>
  import("../Terminal/TerminalPanel").then((module) => ({ default: module.TerminalPanel })),
);

export type WorkbenchView = "files" | "git" | "terminal";

interface WorkbenchPanelProps {
  workspacePath?: string;
  workspaceId?: string;
  view: WorkbenchView;
  onViewChange: (view: WorkbenchView) => void;
  fileTarget?: { path: string; mode?: "edit" | "diff"; nonce: number } | null;
  terminalCommand?: { command: string; mode?: TerminalCommandMode; nonce: number } | null;
}

const WORKBENCH_TABS: Array<{ id: WorkbenchView; labelKey: string }> = [
  { id: "files", labelKey: "workbenchPanel.tabs.files" },
  { id: "git", labelKey: "workbenchPanel.tabs.git" },
  { id: "terminal", labelKey: "workbenchPanel.tabs.terminal" },
];

export function WorkbenchPanel({
  workspacePath,
  workspaceId,
  view,
  onViewChange,
  fileTarget,
  terminalCommand,
}: WorkbenchPanelProps): React.JSX.Element {
  const { t } = useI18n();
  const [terminalMounted, setTerminalMounted] = useState(view === "terminal");
  const shouldMountTerminal = terminalMounted || view === "terminal";

  useEffect(() => {
    if (view === "terminal") setTerminalMounted(true);
  }, [view]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--mm-bg-body)]">
      <div className="flex h-12 shrink-0 items-center border-b border-[var(--mm-border)] px-6">
        <div className="flex h-full items-center gap-5" role="tablist" aria-label={t("workbenchPanel.ariaLabel")}>
          {WORKBENCH_TABS.map((tab) => {
            const active = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onViewChange(tab.id)}
                className={`relative h-full text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-accent-blue)] ${
                  active
                    ? "text-[var(--mm-text-primary)]"
                    : "text-[var(--mm-text-tertiary)] hover:text-[var(--mm-text-primary)]"
                }`}
              >
                {t(tab.labelKey)}
                {active ? (
                  <span className="absolute inset-x-0 bottom-0 h-px bg-[var(--mm-accent-blue)]" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {!workspacePath || !workspaceId ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-[var(--mm-text-secondary)]">
            {t("workbenchPanel.workspaceRequired")}
          </div>
        ) : (
          <>
            {view === "files" ? (
              <Suspense fallback={<WorkbenchLoading label={t("workbenchPanel.loading.files")} />}>
                <FileWorkspace
                  workspacePath={workspacePath}
                  workspaceId={workspaceId}
                  initialTarget={fileTarget}
                />
              </Suspense>
            ) : null}
            {view === "git" ? <GitPanel workspacePath={workspacePath} /> : null}
            {shouldMountTerminal ? (
              <div className={view === "terminal" ? "h-full" : "hidden"}>
                <Suspense fallback={<WorkbenchLoading label={t("workbenchPanel.loading.terminal")} />}>
                  <TerminalPanel
                    isOpen
                    displayMode="embedded"
                    workspacePath={workspacePath}
                    initialCommand={terminalCommand}
                    onClose={() => onViewChange("files")}
                  />
                </Suspense>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function WorkbenchLoading({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center text-sm text-[var(--mm-text-secondary)]" role="status">
      {label}
    </div>
  );
}

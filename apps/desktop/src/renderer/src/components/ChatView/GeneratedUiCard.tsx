import React, { useState } from "react";
import { isIpcError, type GeneratedUiAction, type GeneratedUiCardV1, type GeneratedUiListItem } from "@shared";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface GeneratedUiCardProps {
  card: GeneratedUiCardV1;
  badgeLabel?: string;
}

function statusClass(status?: string): string {
  if (status === "completed" || status === "done" || status === "success") return "bg-[#dcfce7] text-[var(--color-success)]";
  if (status === "running" || status === "progress") return "bg-[#dbeafe] text-[var(--color-info)]";
  if (status === "failed" || status === "error") return "bg-[#fee2e2] text-[var(--color-error)]";
  return "bg-[var(--mm-bg-sidebar)] text-[var(--mm-text-secondary)]";
}

async function runAction(action: GeneratedUiAction): Promise<string | null> {
  switch (action.kind) {
    case "open-file":
      if (!window.piAPI?.openPath) return "系统打开能力不可用";
      {
        const result = await window.piAPI.openPath(action.value);
        if (isIpcError(result)) throw new Error(result.fallback);
        if (typeof result === "string" && result.trim()) throw new Error(result);
      }
      return "已请求系统打开";
    case "copy-text":
      await navigator.clipboard.writeText(action.value);
      return "已复制";
    case "switch-view":
      window.dispatchEvent(new CustomEvent("app:switch-section", { detail: { section: action.value } }));
      return null;
    case "refresh":
      window.dispatchEvent(new CustomEvent("custom-card:refresh", { detail: { id: action.id, value: action.value } }));
      return null;
    case "slash-command":
      window.dispatchEvent(new CustomEvent("chatpanel:prefill", { detail: { text: action.value } }));
      return null;
  }
}

function renderListItems(items: GeneratedUiListItem[]): React.JSX.Element {
  return (
    <ul className="m-0 list-none space-y-1 p-0">
      {items.map((item) => (
        <li key={item.id} className="rounded-md border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] px-2.5 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs font-medium">{item.label}</span>
            {item.status && (
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${statusClass(item.status)}`}>
                {item.status}
              </span>
            )}
          </div>
          {item.description && <p className="m-0 mt-1 text-[11px] text-[var(--mm-text-secondary)]">{item.description}</p>}
          {item.path && <p className="m-0 mt-1 truncate font-mono text-[10px] text-[var(--mm-text-tertiary)]">{item.path}</p>}
        </li>
      ))}
    </ul>
  );
}

export function GeneratedUiCard({ card, badgeLabel }: GeneratedUiCardProps): React.JSX.Element {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  return (
    <div className="rounded-lg border border-[#e7e7e3] bg-[var(--mm-bg-panel)] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="m-0 text-[13px] font-medium">{card.title || "Pi 生成式卡片"}</h3>
        <span className="rounded bg-[var(--mm-bg-panel)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--mm-text-tertiary)]">
          {badgeLabel || card.version}
        </span>
      </div>

      <div className="space-y-3">
        {card.sections.map((section) => {
          switch (section.kind) {
            case "summary":
              return (
                <div key={section.id} className="rounded-md bg-[var(--mm-bg-sidebar)] px-2.5 py-2 text-sm text-[var(--mm-text-primary)]">
                  <MarkdownRenderer content={section.content} />
                </div>
              );
            case "markdown":
              return (
                <div key={section.id} className="text-xs leading-5 text-[var(--mm-text-secondary)]">
                  <MarkdownRenderer content={section.content} />
                </div>
              );
            case "status_list":
            case "steps":
            case "file_list":
              return <div key={section.id}>{renderListItems(section.items)}</div>;
            case "key_value":
              return (
                <dl key={section.id} className="m-0 divide-y divide-[var(--mm-border)] rounded-md border border-[var(--mm-border)] bg-[var(--mm-bg-panel)]">
                  {section.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-[84px_minmax(0,1fr)] gap-2 px-2.5 py-2 text-xs">
                      <dt className="text-[var(--mm-text-tertiary)]">{item.key}</dt>
                      <dd className="m-0 truncate text-[var(--mm-text-primary)]">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              );
            case "action_bar":
              return (
                <div key={section.id} className="flex flex-wrap gap-1.5">
                  {section.actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => {
                        setActiveAction(action.id);
                        setActionStatus(null);
                        void runAction(action)
                          .then((message) => {
                            if (message) setActionStatus({ message, tone: "success" });
                          })
                          .catch((err: unknown) => {
                            setActionStatus({
                              message: err instanceof Error ? err.message : String(err),
                              tone: "error",
                            });
                          })
                          .finally(() => setActiveAction(null));
                      }}
                      className="rounded-md border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] px-2 py-1 text-[11px] text-[var(--mm-text-secondary)] hover:bg-[var(--mm-bg-hover)] hover:text-[var(--mm-text-primary)]"
                    >
                      {activeAction === action.id ? "处理中..." : action.label}
                    </button>
                  ))}
                  {actionStatus && (
                    <span
                      className={`self-center text-[11px] ${actionStatus.tone === "error" ? "text-[var(--color-error)]" : "text-[var(--color-success)]"}`}
                      role={actionStatus.tone === "error" ? "alert" : "status"}
                    >
                      {actionStatus.message}
                    </span>
                  )}
                </div>
              );
          }
        })}
      </div>
    </div>
  );
}

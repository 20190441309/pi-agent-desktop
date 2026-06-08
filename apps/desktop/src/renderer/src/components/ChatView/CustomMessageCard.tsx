import React, { useState } from "react";
import { isIpcError, type CustomMessageCard as CustomMessageCardType, type CustomMessageCardAction } from "@shared";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface CustomMessageCardProps {
  card: CustomMessageCardType;
}

function statusClass(status?: string): string {
  if (status === "completed" || status === "done" || status === "success") return "bg-[#dcfce7] text-[#166534]";
  if (status === "running" || status === "progress") return "bg-[#dbeafe] text-[#1d4ed8]";
  if (status === "failed" || status === "error") return "bg-[#fee2e2] text-[#b91c1c]";
  return "bg-[#f4f4f1] text-[var(--mm-text-secondary)]";
}

async function runAction(action: CustomMessageCardAction): Promise<string | null> {
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

export function CustomMessageCard({ card }: CustomMessageCardProps): React.JSX.Element {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  if (card.kind === "markdown-fallback") {
    return (
      <div className="rounded-lg border border-[#ecece8] bg-[#fbfbfa] p-3 text-sm">
        {card.title && <div className="mb-2 text-[13px] font-medium">{card.title}</div>}
        <MarkdownRenderer content={card.content || ""} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#e7e7e3] bg-[#fbfbfa] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="m-0 text-[13px] font-medium">{card.title || "Pi 扩展卡片"}</h3>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] uppercase text-[var(--mm-text-tertiary)]">
          {card.kind}
        </span>
      </div>
      {card.content && (
        <div className="mb-2 text-xs leading-5 text-[var(--mm-text-secondary)]">
          <MarkdownRenderer content={card.content} />
        </div>
      )}
      {card.items && card.items.length > 0 && (
        <ul className="m-0 list-none space-y-1 p-0">
          {card.items.map((item) => (
            <li key={item.id} className="rounded-md border border-[#eeeeea] bg-white px-2.5 py-2">
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
      )}
      {card.actions && card.actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.actions.map((action) => (
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
              className="rounded-md border border-[#e5e5e0] bg-white px-2 py-1 text-[11px] text-[var(--mm-text-secondary)] hover:bg-[#f5f5f2] hover:text-[var(--mm-text-primary)]"
            >
              {activeAction === action.id ? "处理中..." : action.label}
            </button>
          ))}
          {actionStatus && (
            <span
              className={`self-center text-[11px] ${actionStatus.tone === "error" ? "text-[#b91c1c]" : "text-[#166534]"}`}
              role={actionStatus.tone === "error" ? "alert" : "status"}
            >
              {actionStatus.message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";

export type WorkspaceNotice = {
    id?: string;
    message: string;
    tone: "success" | "error" | "info";
};

const TONE_CLASS: Record<WorkspaceNotice["tone"], string> = {
    success: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
    error: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
    info: "border-[var(--mm-border)] bg-[var(--mm-bg-panel)] text-[var(--mm-text-primary)]",
};

export function emitWorkspaceNotice(notice: WorkspaceNotice): void {
    window.dispatchEvent(new CustomEvent("workspace:notice", { detail: notice }));
}

export function WorkspaceNoticeBanner(): React.JSX.Element | null {
    const [notice, setNotice] = useState<WorkspaceNotice | null>(null);

    useEffect(() => {
        const onNotice = (event: Event): void => {
            const detail = (event as CustomEvent<WorkspaceNotice>).detail;
            if (!detail?.message) return;
            setNotice({ ...detail, id: detail.id ?? `${Date.now()}` });
        };
        window.addEventListener("workspace:notice", onNotice);
        return () => window.removeEventListener("workspace:notice", onNotice);
    }, []);

    if (!notice) return null;

    return (
        <div
            role={notice.tone === "error" ? "alert" : "status"}
            data-workspace-notice={notice.tone}
            className={`flex items-center gap-3 border-b px-4 py-2 text-sm ${TONE_CLASS[notice.tone]}`}
        >
            <span className="flex-1 truncate">{notice.message}</span>
            <button
                type="button"
                onClick={() => setNotice(null)}
                className="shrink-0 rounded-[var(--mm-radius-sm)] px-2 py-1 text-xs opacity-70 hover:bg-white/60 hover:opacity-100"
                aria-label="关闭工作区提示"
            >
                x
            </button>
        </div>
    );
}

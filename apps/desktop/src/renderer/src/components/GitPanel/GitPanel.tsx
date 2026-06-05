// GitPanel — Git 状态查看 + 操作 (commit / diff / undo)
// v1.1: 真接通 useGit hook, 显示分支/变更文件/diff/提交

import React, { useState, useCallback } from "react";
import { useGit } from "../../hooks/useGit";

interface GitPanelProps {
    workspacePath: string;
}

type DetailView = "diff" | "log" | "none";

export function GitPanel({ workspacePath }: GitPanelProps): React.JSX.Element {
    const git = useGit(workspacePath);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [detailView, setDetailView] = useState<DetailView>("none");
    const [diffContent, setDiffContent] = useState<string>("");
    const [commitMessage, setCommitMessage] = useState("");
    const [committing, setCommitting] = useState(false);

    // 点击变更文件时, 加载 diff
    const handleFileClick = useCallback(
        async (filePath: string) => {
            setSelectedFile(filePath);
            setDetailView("diff");
            const d = await git.loadDiff(filePath);
            setDiffContent(d);
        },
        [git],
    );

    // 暂存文件 (git add)
    const handleStage = useCallback(
        async (files: string[]) => {
            await git.stageFiles(files);
        },
        [git],
    );

    // 提交
    const handleCommit = useCallback(async () => {
        if (!commitMessage.trim()) return;
        setCommitting(true);
        try {
            await git.commit(commitMessage.trim());
            setCommitMessage("");
        } catch (err) {
            window.alert(`提交失败: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setCommitting(false);
        }
    }, [git, commitMessage]);

    // 撤销单个文件
    const handleUndo = useCallback(
        async (filePath: string) => {
            await git.undo(filePath);
            setSelectedFile(null);
            setDetailView("none");
            setDiffContent("");
        },
        [git],
    );

    // 查看暂存 diff
    const handleViewStaged = useCallback(async () => {
        setDetailView("log");
        const _d = await git.loadStagedDiff();
        // staged diff 查看器 — 当前简化版直接切换到 log tab
        void _d;
    }, [git]);

    const { status, commits, isLoading, error } = git;

    if (isLoading && !status) {
        return (
            <div className="flex items-center justify-center h-full text-sm text-[#999]">
                加载 Git 状态...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <p className="text-sm text-[#ef4444] mb-2">Git 错误</p>
                <p className="text-xs text-[#666]">{error}</p>
                <button
                    type="button"
                    onClick={() => void git.refresh()}
                    className="mt-3 px-3 py-1.5 text-xs bg-[#1a1a1a] text-white rounded hover:bg-[#333]"
                >
                    重试
                </button>
            </div>
        );
    }

    if (!status) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <svg className="w-10 h-10 text-[#e5e5e5] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p className="text-sm text-[#999]">此工作区不是 Git 仓库</p>
                <p className="text-xs text-[#ccc] mt-1">初始化仓库后可使用 Git 功能</p>
            </div>
        );
    }

    const allChanges = [
        ...status.modified.map((f) => ({ file: f, type: "modified" as const })),
        ...status.added.map((f) => ({ file: f, type: "added" as const })),
        ...status.deleted.map((f) => ({ file: f, type: "deleted" as const })),
        ...status.untracked.map((f) => ({ file: f, type: "untracked" as const })),
    ];
    const totalChanges = allChanges.length;

    return (
        <div className="flex flex-col h-full bg-[var(--mm-bg-sidebar)]" role="region" aria-label="Git 面板">
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5e5] bg-[#fafafa]">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="text-sm font-medium text-[#1a1a1a]">Git</span>
                    {/* 分支标签 */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#f0f7ff] text-[#0066cc] rounded text-xs font-mono">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {status.branch}
                    </span>
                    {status.ahead > 0 && (
                        <span className="text-[10px] text-[#10b981]">↑{status.ahead}</span>
                    )}
                    {status.behind > 0 && (
                        <span className="text-[10px] text-[#f59e0b]">↓{status.behind}</span>
                    )}
                    {totalChanges > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold text-white bg-[#f59e0b]">
                            {totalChanges}
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => void git.refresh()}
                    className="p-1 rounded hover:bg-[#e5e5e5] transition-colors text-[#999]"
                    title="刷新"
                    aria-label="刷新 Git 状态"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* 变更文件列表 */}
            <div className="flex-1 overflow-y-auto">
                {totalChanges === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <svg className="w-10 h-10 text-[#e5e5e5] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-[#999]">工作区干净</p>
                        <p className="text-xs text-[#ccc] mt-1">没有未提交的变更</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-[#f0f0f0]" role="list" aria-label="变更文件列表">
                        {allChanges.map(({ file, type }) => (
                            <li
                                key={`${type}:${file}`}
                                className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#f5f5f5] transition-colors ${
                                    selectedFile === file ? "bg-[#f0f7ff]" : ""
                                }`}
                                role="listitem"
                                onClick={() => void handleFileClick(file)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") void handleFileClick(file);
                                }}
                                tabIndex={0}
                            >
                                <ChangeTypeBadge type={type} />
                                <span className="flex-1 min-w-0 text-sm text-[#1a1a1a] font-mono truncate" title={file}>
                                    {file}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void handleUndo(file);
                                    }}
                                    className="p-1 rounded hover:bg-[#e5e5e5] text-[#999] hover:text-[#1a1a1a] transition-colors"
                                    title="撤销变更"
                                    aria-label={`撤销 ${file}`}
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
                                    </svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Diff 查看 */}
            {detailView === "diff" && selectedFile && (
                <div className="border-t border-[#e5e5e5] bg-[#fafafa] flex flex-col" style={{ height: 240 }}>
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[#e5e5e5]">
                        <span className="text-xs font-mono text-[#1a1a1a] truncate">{selectedFile}</span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => void handleStage([selectedFile])}
                                className="px-2 py-1 text-xs bg-[#10b981] text-white rounded hover:bg-[#059669] transition-colors"
                            >
                                暂存
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setDetailView("none");
                                    setSelectedFile(null);
                                    setDiffContent("");
                                }}
                                className="p-1 rounded hover:bg-[#e5e5e5] text-[#999]"
                                aria-label="关闭 diff"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <pre className="flex-1 overflow-auto p-3 text-xs font-mono text-[#666] leading-relaxed bg-[#1a1a1a] text-[#e5e5e5]">
                        {diffContent || "(无 diff 内容)"}
                    </pre>
                </div>
            )}

            {/* 提交区 */}
            <div className="border-t border-[#e5e5e5] px-3 py-3">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="提交信息..."
                        disabled={committing || totalChanges === 0}
                        className="flex-1 px-3 py-2 text-sm bg-[#f5f5f5] border border-[#e5e5e5] rounded text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:border-[#1a1a1a] disabled:opacity-50"
                        aria-label="提交信息"
                    />
                    <button
                        type="button"
                        onClick={() => void handleCommit()}
                        disabled={committing || !commitMessage.trim() || totalChanges === 0}
                        className="px-4 py-2 text-sm bg-[#1a1a1a] text-white rounded hover:bg-[#333] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        {committing ? "提交中..." : "提交"}
                    </button>
                </div>
                {totalChanges > 0 && (
                    <button
                        type="button"
                        onClick={() => void handleStage(allChanges.map((c) => c.file))}
                        className="mt-2 text-xs text-[#666] hover:text-[#1a1a1a] transition-colors"
                    >
                        全部暂存
                    </button>
                )}
            </div>

            {/* 最近提交 */}
            {commits.length > 0 && (
                <div className="border-t border-[#e5e5e5] max-h-40 overflow-y-auto">
                    <div className="flex items-center justify-between px-3 py-2 bg-[#fafafa]">
                        <span className="text-[10px] uppercase tracking-wider text-[#999]">最近提交</span>
                        <button
                            type="button"
                            onClick={() => void handleViewStaged()}
                            className="text-xs text-[#666] hover:text-[#1a1a1a] transition-colors"
                        >
                            查看暂存
                        </button>
                    </div>
                    {commits.slice(0, 5).map((c) => (
                        <div key={c.hash} className="px-3 py-1.5 border-t border-[#f0f0f0]">
                            <p className="text-xs text-[#1a1a1a] truncate">{c.message}</p>
                            <p className="text-[10px] text-[#999] font-mono">{c.hash.slice(0, 7)} · {c.author} · {formatRelativeTime(c.date)}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** 变更类型标签 */
function ChangeTypeBadge({ type }: { type: "modified" | "added" | "deleted" | "untracked" }): React.JSX.Element {
    const config = {
        modified: { label: "M", className: "bg-[#dbeafe] text-[#1d4ed8]" },
        added: { label: "A", className: "bg-[#dcfce7] text-[#166534]" },
        deleted: { label: "D", className: "bg-[#fef2f2] text-[#991b1b]" },
        untracked: { label: "?", className: "bg-[#f5f5f5] text-[#666]" },
    }[type];
    return (
        <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold ${config.className}`}>
            {config.label}
        </span>
    );
}

/** 简单的相对时间格式化 */
function formatRelativeTime(date: string | Date): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = Date.now();
    const diff = now - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) return d.toLocaleDateString();
    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return "刚刚";
}
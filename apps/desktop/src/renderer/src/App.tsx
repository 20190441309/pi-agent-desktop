// Pi Desktop v1.0 - Minimal App (M6-2)
// 只集成 M1-M5 工作中组件 + 简单的 chat 输入框
// 旧 UI 组件已归档到 docs/design-archive/legacy-components/, 等 v1.1 重做

import React, { useEffect, useState } from "react";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { CommandPalette, type CommandMode } from "./components/CommandPalette/CommandPalette";
import { SkillsPanel } from "./components/SkillsPanel/SkillsPanel";
import { TerminalPanel } from "./components/Terminal/TerminalPanel";
import { useWorkspaceStore } from "./stores/workspace-store";
import { useSessionStore } from "./stores/session-store";
import { usePiStatusStore } from "./stores/pi-status-store";

type Panel = "chat" | "skills" | "terminal";

function App(): React.ReactElement {
    const [activePanel, setActivePanel] = useState<Panel>("chat");
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [paletteMode] = useState<CommandMode>("file");
    void paletteMode;
    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string }>>([]);

    const { workspaces, currentWorkspaceId, setCurrentWorkspace } = useWorkspaceStore();
    const { sessions, currentSessionId, createSession, addMessage } = useSessionStore();
    const { status, refreshStatus } = usePiStatusStore();

    const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

    // 启动时拉 workspace 列表
    useEffect(() => {
        if (!window.piAPI) return;
        void window.piAPI.listWorkspaces().then((list: Array<{ id: string }>) => {
            if (list.length > 0 && !currentWorkspaceId) {
                setCurrentWorkspace(list[0].id);
            }
        }).catch(() => { /* noop */ });
        void refreshStatus();
    }, [refreshStatus, setCurrentWorkspace, currentWorkspaceId]);

    // Ctrl+K 快捷键
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setPaletteOpen((v) => !v);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // 订阅 Pi 事件
    useEffect(() => {
        if (!window.piAPI?.onEvent) return;
        return window.piAPI.onEvent((event: { type: string; delta?: string }) => {
            if (event.type === "text_delta") {
                setMessages((m) => {
                    const last = m[m.length - 1];
                    if (last && last.role === "assistant") {
                        return [...m.slice(0, -1), { ...last, content: last.content + (event.delta ?? "") }];
                    }
                    return [...m, { id: `a_${Date.now()}`, role: "assistant", content: event.delta ?? "" }];
                });
            }
        });
    }, []);

    const sendMessage = async () => {
        const content = chatInput.trim();
        if (!content || !window.piAPI || !currentWorkspace) return;

        const userMsg = { id: `u_${Date.now()}`, role: "user" as const, content };
        setMessages((m) => [...m, userMsg]);
        setChatInput("");

        // 确保有 session
        let sessionId = currentSessionId;
        if (!sessionId) {
            const newSession = createSession(currentWorkspace.id);
            sessionId = newSession.id;
        }
        addMessage(sessionId ?? "", { ...userMsg, role: "user", timestamp: new Date() });

        try {
            await window.piAPI.sendPrompt(currentWorkspace.id, content);
        } catch (err) {
            setMessages((m) => [
                ...m,
                { id: `e_${Date.now()}`, role: "assistant", content: `Error: ${String(err)}` },
            ]);
        }
    };

    const handleNewWorkspace = async () => {
        if (!window.piAPI) return;
        const path = await window.piAPI.selectDirectory();
        if (!path) return;
        const name = path.split(/[\\/]/).pop() ?? "workspace";
        const ws = await window.piAPI.createWorkspace(name, path);
        setCurrentWorkspace(ws.id);
    };

    return (
        <ErrorBoundary>
            <div className="flex flex-col h-screen bg-[#fafafa] text-[#1a1a1a] font-sans text-sm">
                {/* 顶栏 */}
                <header className="h-12 bg-white border-b border-[#e5e5e5] flex items-center justify-between px-4 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-[#1a1a1a] rounded-md flex items-center justify-center">
                            <span className="text-white font-bold text-base">π</span>
                        </div>
                        <span className="font-semibold">Pi Desktop</span>
                        <span className="text-xs text-[#999]">v0.1.0</span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${
                            status?.installed ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fee2e2] text-[#991b1b]"
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status?.installed ? "bg-[#22c55e]" : "bg-[#ef4444]"}`} />
                            {status?.installed ? "Pi 已连接" : "Pi 未连接"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPaletteOpen(true)}
                            className="px-3 py-1.5 bg-white border border-[#e5e5e5] rounded text-xs text-[#666] hover:bg-[#f0f0f0]"
                            title="Ctrl+K"
                        >
                            🔍 命令面板 (Ctrl+K)
                        </button>
                        <button
                            onClick={handleNewWorkspace}
                            className="px-3 py-1.5 bg-white border border-[#e5e5e5] rounded text-xs text-[#666] hover:bg-[#f0f0f0]"
                        >
                            + 工作区
                        </button>
                    </div>
                </header>

                {/* 主体: 左 sidebar + 主区 */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar: workspace 列表 + panel 切换 */}
                    <aside className="w-56 bg-white border-r border-[#e5e5e5] flex flex-col flex-shrink-0">
                        <div className="p-3 border-b border-[#e5e5e5]">
                            <div className="text-xs text-[#999] mb-2">面板</div>
                            {([
                                ["chat", "💬 对话", "chat"],
                                ["skills", "🧩 技能", "skills"],
                                ["terminal", "💻 终端", "terminal"],
                            ] as Array<[Panel, string, string]>).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => setActivePanel(key)}
                                    className={`w-full text-left px-3 py-1.5 rounded text-xs mb-1 transition-colors ${
                                        activePanel === key ? "bg-[#1a1a1a] text-white" : "hover:bg-[#f0f0f0] text-[#666]"
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="p-3 flex-1 overflow-y-auto">
                            <div className="text-xs text-[#999] mb-2">工作区</div>
                            {workspaces.length === 0 ? (
                                <div className="text-xs text-[#999]">暂无,点"+ 工作区"添加</div>
                            ) : (
                                workspaces.map((w) => (
                                    <button
                                        key={w.id}
                                        onClick={() => setCurrentWorkspace(w.id)}
                                        className={`w-full text-left px-2 py-1.5 rounded text-xs mb-1 truncate ${
                                            w.id === currentWorkspaceId
                                                ? "bg-[#f0f0f0] text-[#1a1a1a] font-medium"
                                                : "text-[#666] hover:bg-[#f5f5f5]"
                                        }`}
                                        title={w.path}
                                    >
                                        📁 {w.name}
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="p-3 border-t border-[#e5e5e5] text-xs text-[#999]">
                            v0.1.0 — 5/5 milestone done
                        </div>
                    </aside>

                    {/* 主区 */}
                    <main className="flex-1 flex flex-col overflow-hidden">
                        {activePanel === "chat" && (
                            <>
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {messages.length === 0 ? (
                                        <div className="text-center py-16 text-[#999]">
                                            <div className="text-4xl mb-4">π</div>
                                            <div className="text-sm">
                                                {currentWorkspace
                                                    ? `当前工作区: ${currentWorkspace.name}`
                                                    : "选择一个工作区开始对话"}
                                            </div>
                                        </div>
                                    ) : (
                                        messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap ${
                                                        msg.role === "user"
                                                            ? "bg-[#1a1a1a] text-white"
                                                            : "bg-white border border-[#e5e5e5]"
                                                    }`}
                                                >
                                                    {msg.content || (
                                                        <span className="inline-block w-2 h-4 bg-[#999] animate-pulse" />
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="border-t border-[#e5e5e5] bg-white p-4 flex-shrink-0">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    void sendMessage();
                                                }
                                            }}
                                            placeholder={
                                                currentWorkspace
                                                    ? "输入消息,按 Enter 发送..."
                                                    : "先选个工作区"
                                            }
                                            disabled={!currentWorkspace || !status?.installed}
                                            className="flex-1 px-3 py-2 border border-[#e5e5e5] rounded text-sm focus:outline-none focus:border-[#1a1a1a] disabled:bg-[#f5f5f5] disabled:text-[#999]"
                                        />
                                        <button
                                            onClick={() => void sendMessage()}
                                            disabled={!currentWorkspace || !status?.installed || !chatInput.trim()}
                                            className="px-5 py-2 bg-[#1a1a1a] text-white rounded text-sm font-medium hover:bg-[#333] disabled:bg-[#999] disabled:cursor-not-allowed"
                                        >
                                            发送
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                        {activePanel === "skills" && (
                            <div className="flex-1 overflow-hidden">
                                <SkillsPanel />
                            </div>
                        )}
                        {activePanel === "terminal" && (
                            <TerminalPanel
                                isOpen={true}
                                workspacePath={currentWorkspace?.path}
                                onClose={() => setActivePanel("chat")}
                            />
                        )}
                    </main>
                </div>

                {/* 底栏 */}
                <footer className="h-7 bg-white border-t border-[#e5e5e5] flex items-center justify-between px-4 text-xs text-[#999] flex-shrink-0">
                    <span>
                        {sessions.length} session(s) · {currentWorkspace?.path ?? "no workspace"}
                    </span>
                    <span>Pi Desktop v0.1.0 (M1-M5 done · M6 release prep)</span>
                </footer>

                {/* Command Palette 模态 */}
                <CommandPalette
                    isOpen={paletteOpen}
                    onClose={() => setPaletteOpen(false)}
                    workspacePath={currentWorkspace?.path ?? ""}
                />
            </div>
        </ErrorBoundary>
    );
}

export default App;

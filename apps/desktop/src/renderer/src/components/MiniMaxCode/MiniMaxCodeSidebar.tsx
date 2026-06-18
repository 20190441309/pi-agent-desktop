// MiniMaxCodeSidebar — MiniMax Code 参考风格左侧导航栏
//
// 当前只展示会话列表和设置入口,导航功能已移至 TopTabBar。
//
// 视觉规格:
//  - 字号: 主 13px / 次 12px / 分组标题 11px letter-spacing 0.5px 浅灰
//  - 行高 32px,左右 padding 12px
//  - hover 浅灰 --mm-bg-hover (#f0f0f0)
//  - 激活态: 黑底白字 (--mm-bg-active + --mm-text-on-active),圆角 6px
//  - icon 用 inline SVG stroke 1.5;**不**用 emoji, **不**用 lucide-react
//    (项目无 lucide-react 依赖,见 IconBar.tsx 同款约定)
//  - 所有颜色/尺寸走 --mm-*,不硬编码
//
// Props:
//  - currentSection: 当前激活项的 section id
//  - onSectionChange: 点击某项时回调,父级决定路由/视图切换
//  - groupMode: 会话列表分组模式 (date/workspace)
//  - onGroupModeChange: 切换分组模式回调
//
// A11y:
//  - 每个可点击项是 <button> + aria-label,激活态用 aria-current="page"
//  - 分组列表用 <nav role="navigation"> 包裹,加 aria-label
//  - 装饰性图标 aria-hidden="true",不污染辅助阅读
//
// 不持有路由状态: 父级通过 currentSection/onSectionChange 控制激活。

import React, { useState } from "react";
import { useSessionStore } from "../../stores/session-store";
import { useWorkspaceStore } from "../../stores/workspace-store";
import { useI18n } from "../../i18n";
import { ProjectGroupedSessionList } from "./ProjectGroupedSessionList";
import { DateGroupedSessionList } from "./DateGroupedSessionList";

// ----------------------------------------------------------------------
// 类型
// ----------------------------------------------------------------------

export interface MiniMaxCodeSection {
    /** 唯一 id(传给 onSectionChange) */
    id: string;
    /** 显示文案 */
    label: string;
    /** inline SVG icon (16x16 推荐) */
    icon: React.ReactNode;
}

export interface MiniMaxCodeSidebarProps {
    /** 当前激活的 section id */
    currentSection: string;
    /** 当前 workspace;历史列表只显示这个 workspace 的会话 */
    currentWorkspaceId?: string | null;
    /** pi-agent 运行状态，用于左下角状态条 */
    piAgentStatus?: "online" | "offline" | "checking";
    /** 点击某项时回调,父级决定路由切换 */
    onSectionChange: (section: string) => void;
    /** 会话列表分组模式 */
    groupMode?: "date" | "workspace";
    /** 切换分组模式回调 */
    onGroupModeChange?: (mode: "date" | "workspace") => void;
}

// ----------------------------------------------------------------------
// Icons (inline SVG, stroke 1.5, 14x14 视觉)
// 选用 lucide-react 风格的 outline icon,内联避免新增依赖。
// ----------------------------------------------------------------------

function IconSettings(): React.JSX.Element {
    return (
        <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
        </svg>
    );
}

function IconPlus(): React.JSX.Element {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v14m-7-7h14" />
        </svg>
    );
}

function IconChevronDown(): React.JSX.Element {
    return (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
    );
}

// ----------------------------------------------------------------------
// 子组件: 导航项 (设置按钮复用)
// ----------------------------------------------------------------------

interface NavItemProps {
    section: { id: string; label: string; icon: React.ReactNode };
    active: boolean;
    onClick: () => void;
    trailing?: React.ReactNode;
}

function NavItem({ section, active, onClick, trailing }: NavItemProps): React.JSX.Element {
    const baseClasses =
        "flex w-full items-center gap-3 rounded-[var(--mm-radius-sm)] py-0 pl-[10px] pr-3 text-[13px] leading-relaxed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-bg-active)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--mm-bg-sidebar)]";
    const heightClasses = "h-10";
    const stateClasses = active
        ? "border-l-2 border-l-[var(--mm-bg-active)] bg-[var(--mm-bg-selected)] font-medium text-[var(--mm-text-primary)] hover:bg-[var(--mm-bg-selected)]"
        : "border-l-2 border-l-transparent bg-transparent font-normal text-[var(--mm-text-primary)] hover:bg-[var(--mm-bg-hover)]";

    return (
        <div className="group flex items-center gap-1">
            <button
                type="button"
                onClick={onClick}
                aria-label={section.label}
                aria-current={active ? "page" : undefined}
                className={`${baseClasses} ${heightClasses} ${stateClasses} min-w-0 flex-1`}
                data-mmcode-section={section.id}
            >
                <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center"
                    aria-hidden="true"
                >
                    {section.icon}
                </span>
                <span className="truncate text-left">{section.label}</span>
            </button>
            {trailing}
        </div>
    );
}

// ----------------------------------------------------------------------
// 主组件
// ----------------------------------------------------------------------

/**
 * MiniMax Code 风格左侧导航栏.
 *
 * 排版结构:
 *   - 顶部 logo
 *   - 新建对话按钮 + 分组模式切换
 *   - 中间 scroll 区: 会话历史列表
 *   - 底部设置按钮
 *
 * 设计约束:
 *   - 所有颜色/字号/圆角走 --mm-* token
 *   - 不持有业务状态,父级通过 currentSection/onSectionChange 控制激活
 *   - 极简 a11y: button + aria-label + aria-current
 */
export function MiniMaxCodeSidebar({
    currentSection,
    currentWorkspaceId,
    piAgentStatus = "checking",
    onSectionChange,
    groupMode = "date",
    onGroupModeChange,
}: MiniMaxCodeSidebarProps): React.JSX.Element {
    const { t } = useI18n();
    const currentSessionId = useSessionStore((state) => state.currentSessionId);
    const archiveSession = useSessionStore((state) => state.archiveSession);
    const deleteSession = useSessionStore((state) => state.deleteSession);
    const [showGroupMenu, setShowGroupMenu] = useState(false);
    const agentOnline = piAgentStatus === "online";
    const agentChecking = piAgentStatus === "checking";
    const agentStatusLabel = agentChecking
        ? t("sidebar.status.checking")
        : agentOnline
            ? t("sidebar.status.online")
            : t("sidebar.status.offline");
    const agentDotClass = agentChecking
        ? "bg-[var(--mm-text-tertiary)]"
        : agentOnline
            ? "bg-[var(--color-success)]"
            : "bg-[var(--color-error)]";

    return (
        <div
            className="flex h-full w-full flex-col bg-[var(--mm-bg-sidebar)] text-[var(--mm-text-primary)]"
            data-mmcode-component="sidebar"
        >
            {/* ============== 顶部 logo (固定,不滚动) ============== */}
            <div
                className="flex h-14 shrink-0 items-center gap-2 px-3"
                data-mmcode-region="logo"
            >
                <div
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--mm-radius-md)] bg-[var(--mm-bg-active)] text-[13px] font-semibold text-[var(--mm-text-on-active)]"
                    aria-hidden="true"
                >
                    π
                </div>
                <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">Pi Agent</div>
                    <div className="truncate text-[11px] text-[var(--mm-text-tertiary)]">{t("sidebar.subtitle")}</div>
                </div>
            </div>

            {/* ============== 中间 scroll 区 ============== */}
            <nav
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-4 pt-2"
                aria-label="会话列表"
            >
                {/* 新建对话按钮 */}
                <button
                    type="button"
                    onClick={() => onSectionChange("new-task")}
                    aria-current={currentSection === "new-task" ? "page" : undefined}
                    className={`flex h-9 w-full items-center gap-2 rounded-[var(--mm-radius-sm)] border px-3 text-[13px] transition-colors focus:outline-none ${
                        currentSection === "new-task"
                            ? "border-[var(--mm-bg-active)] bg-[var(--mm-bg-selected)] font-medium text-[var(--mm-text-primary)]"
                            : "border-[var(--mm-border)] text-[var(--mm-text-secondary)] hover:bg-[var(--mm-bg-hover)] hover:text-[var(--mm-text-primary)]"
                    }`}
                    data-mmcode-section="new-task"
                >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                        <IconPlus />
                    </span>
                    <span>{t("sidebar.newConversation")}</span>
                </button>

                {/* 分组模式切换 */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowGroupMenu(!showGroupMenu)}
                        className="flex h-7 w-full items-center gap-1.5 rounded-[var(--mm-radius-sm)] px-2 text-[11px] text-[var(--mm-text-tertiary)] transition-colors hover:bg-[var(--mm-bg-hover)] hover:text-[var(--mm-text-secondary)] focus:outline-none"
                        aria-haspopup="true"
                        aria-expanded={showGroupMenu}
                    >
                        <span className="flex-1 text-left">
                            {groupMode === "date" ? t("sidebar.groupByDate") : t("sidebar.groupByWorkspace")}
                        </span>
                        <IconChevronDown />
                    </button>
                    {showGroupMenu && (
                        <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-[var(--mm-radius-sm)] border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] py-1 shadow-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    onGroupModeChange?.("date");
                                    setShowGroupMenu(false);
                                }}
                                className={`flex h-7 w-full items-center px-2 text-[12px] transition-colors hover:bg-[var(--mm-bg-hover)] ${
                                    groupMode === "date" ? "font-medium text-[var(--mm-text-primary)]" : "text-[var(--mm-text-secondary)]"
                                }`}
                            >
                                {t("sidebar.groupByDate")}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onGroupModeChange?.("workspace");
                                    setShowGroupMenu(false);
                                }}
                                className={`flex h-7 w-full items-center px-2 text-[12px] transition-colors hover:bg-[var(--mm-bg-hover)] ${
                                    groupMode === "workspace" ? "font-medium text-[var(--mm-text-primary)]" : "text-[var(--mm-text-secondary)]"
                                }`}
                            >
                                {t("sidebar.groupByWorkspace")}
                            </button>
                        </div>
                    )}
                </div>

                {/* 会话列表 */}
                {groupMode === "date" ? (
                    <DateGroupedSessionList
                        currentSessionId={currentSessionId}
                        onSelectSession={(id) => onSectionChange(`session:${id}`)}
                        onArchiveSession={archiveSession}
                        onDeleteSession={deleteSession}
                    />
                ) : (
                    <ProjectGroupedSessionList
                        currentWorkspaceId={currentWorkspaceId ?? null}
                        currentSessionId={currentSessionId}
                        onSelectSession={(id) => onSectionChange(`session:${id}`)}
                        onArchiveSession={archiveSession}
                        onDeleteSession={deleteSession}
                        onSwitchWorkspace={(wid) => useWorkspaceStore.getState().setCurrentWorkspace(wid)}
                    />
                )}
            </nav>

            {/* ============== 底部设置 (固定,不滚动) ============== */}
            <div className="shrink-0 border-t border-[var(--mm-border)] px-2 py-2">
                <div className="flex items-center gap-2">
                    <NavItem
                        section={{ id: "settings", label: t("sidebar.settings"), icon: <IconSettings /> }}
                        active={currentSection === "settings"}
                        onClick={() => onSectionChange("settings")}
                    />
                    <div
                        className="flex items-center gap-1.5 shrink-0 px-2"
                        role="status"
                        aria-label={agentStatusLabel}
                        title={agentStatusLabel}
                    >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${agentDotClass}`} aria-hidden="true" />
                        <span className="text-[11px] text-[var(--mm-text-tertiary)] whitespace-nowrap">{agentStatusLabel}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}



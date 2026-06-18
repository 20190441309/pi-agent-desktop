import React from "react";
import { useI18n } from "../../i18n";

export interface TopTabBarProps {
    activeTab: string;
    onTabChange: (tabId: string) => void;
    rightSlot?: React.ReactNode;
}

// Icons: inline SVG, stroke 1.5, 16x16 viewBox, matching existing icon style

function IconChat(): React.JSX.Element {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
        </svg>
    );
}

function IconTasks(): React.JSX.Element {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
        </svg>
    );
}

function IconMemory(): React.JSX.Element {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
        </svg>
    );
}

function IconTools(): React.JSX.Element {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            />
        </svg>
    );
}

function IconSettings(): React.JSX.Element {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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

interface TabDef {
    id: string;
    labelKey: string;
    icon: React.ReactNode;
}

const TAB_DEFS: TabDef[] = [
    { id: "chat", labelKey: "topbar.chat", icon: <IconChat /> },
    { id: "tasks", labelKey: "topbar.tasks", icon: <IconTasks /> },
    { id: "memory", labelKey: "topbar.memory", icon: <IconMemory /> },
    { id: "tools", labelKey: "topbar.tools", icon: <IconTools /> },
    { id: "settings", labelKey: "topbar.settings", icon: <IconSettings /> },
];

export function TopTabBar({ activeTab, onTabChange, rightSlot }: TopTabBarProps): React.JSX.Element {
    const { t } = useI18n();

    return (
        <div
            className="flex h-[var(--mm-height-tabbar)] shrink-0 items-center border-b border-[var(--mm-border)] bg-[var(--mm-bg-sidebar)]"
            data-mmcode-component="top-tabbar"
            role="tablist"
            aria-label={t("topbar.ariaLabel")}
        >
            <div className="flex h-full items-center">
                {TAB_DEFS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            aria-label={t(tab.labelKey)}
                            onClick={() => onTabChange(tab.id)}
                            className={`relative flex h-full items-center gap-1.5 px-3 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mm-bg-active)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--mm-bg-sidebar)] ${
                                isActive
                                    ? "font-medium text-[var(--mm-text-primary)]"
                                    : "font-normal text-[var(--mm-text-secondary)] hover:bg-[var(--mm-bg-hover)] hover:text-[var(--mm-text-primary)]"
                            }`}
                            data-mmcode-tab={tab.id}
                        >
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                                {tab.icon}
                            </span>
                            <span className="whitespace-nowrap">{t(tab.labelKey)}</span>
                            {isActive && (
                                <span
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--mm-bg-active)]"
                                    aria-hidden="true"
                                />
                            )}
                        </button>
                    );
                })}
            </div>
            {rightSlot && <div className="ml-auto flex items-center pr-3">{rightSlot}</div>}
        </div>
    );
}

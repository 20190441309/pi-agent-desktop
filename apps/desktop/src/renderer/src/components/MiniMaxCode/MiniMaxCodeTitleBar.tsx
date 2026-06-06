// MiniMaxCodeTitleBar — 32px 顶部标题栏
// v2.0: 新增左右栏折叠/展开按钮

import React, { useEffect, useState } from "react";

const TITLE_BAR_HEIGHT = 32;
const MAC_TRAFFIC_LIGHT_RESERVE = 80;

export interface MiniMaxCodeTitleBarProps {
    title?: string;
    leftCollapsed?: boolean;
    rightCollapsed?: boolean;
    onToggleLeft?: () => void;
    onToggleRight?: () => void;
    className?: string;
}

const MinimizeIcon: React.FC = () => (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1}><line x1="2" y1="6" x2="10" y2="6" /></svg>
);
const MaximizeIcon: React.FC = () => (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1}><rect x="2.5" y="2.5" width="7" height="7" /></svg>
);
const UnmaximizeIcon: React.FC = () => (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1}><rect x="3.5" y="3.5" width="5" height="5" /><path d="M5.5 3.5 V2 H10 V6.5 H8.5" /></svg>
);
const CloseIcon: React.FC = () => (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1}><line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" /></svg>
);

// 折叠图标: 两条竖线
const SidebarCollapseIcon: React.FC = () => (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
        <rect x="2" y="2" width="4" height="12" rx="1" />
        <rect x="10" y="2" width="4" height="12" rx="1" />
    </svg>
);
// 展开图标: 带箭头的两条竖线
const SidebarExpandIcon: React.FC = () => (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
        <rect x="2" y="2" width="4" height="12" rx="1" />
        <rect x="10" y="2" width="4" height="12" rx="1" />
        <path d="M8 5 L8 11" strokeDasharray="2 1" />
    </svg>
);
// 右侧栏折叠图标
const RightPanelCollapseIcon: React.FC = () => (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
        <rect x="1" y="3" width="10" height="10" rx="1" />
        <line x1="14" y1="3" x2="14" y2="13" />
    </svg>
);

const TitleBarButton: React.FC<{
    onClick: () => void;
    ariaLabel: string;
    children: React.ReactNode;
    className?: string;
}> = ({ onClick, ariaLabel, children, className = "" }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        className={`flex h-8 w-10 items-center justify-center text-[var(--mm-text-tertiary)] transition-colors duration-150 hover:bg-[var(--mm-bg-hover)] focus:outline-none focus-visible:bg-[var(--mm-bg-hover)] rounded-md ${className}`}
    >
        {children}
    </button>
);

export function MiniMaxCodeTitleBar({
    title,
    leftCollapsed = false,
    rightCollapsed = false,
    onToggleLeft,
    onToggleRight,
    className = "",
}: MiniMaxCodeTitleBarProps): React.JSX.Element {
    const [isMaximized, setIsMaximized] = useState(false);
    const [platform, setPlatform] = useState<NodeJS.Platform | "browser">("browser");

    useEffect(() => {
        if (typeof window === "undefined" || !window.nodeAPI) return;
        setPlatform(window.nodeAPI.platform);
        void window.piAPI?.windowIsMaximized().then(setIsMaximized);
        const unsub = window.piAPI?.onWindowMaximizeChanged((max) => setIsMaximized(max));
        return () => { if (typeof unsub === "function") unsub(); };
    }, []);

    const isMac = platform === "darwin";
    const leftPad = isMac ? MAC_TRAFFIC_LIGHT_RESERVE : 10;

    return (
        <div
            style={{ WebkitAppRegion: "drag", height: TITLE_BAR_HEIGHT } as React.CSSProperties}
            className={`flex w-full shrink-0 items-center border-b border-[var(--mm-border)] bg-[var(--mm-bg-sidebar)] select-none ${className}`}
            data-mmcode-region="titlebar"
            role="banner"
            aria-label="window title bar"
        >
            {/* 左侧 */}
            <div
                style={{ width: isMac ? leftPad : "var(--mm-width-sidebar-left)", flexShrink: 0 }}
                className="flex h-full items-center gap-1 px-2"
                data-mmcode-region="titlebar-left"
            >
                {!isMac && (
                    <>
                        {onToggleLeft && (
                            <TitleBarButton
                                ariaLabel={leftCollapsed ? "展开左侧栏" : "折叠左侧栏"}
                                onClick={onToggleLeft}
                            >
                                {leftCollapsed ? <SidebarExpandIcon /> : <SidebarCollapseIcon />}
                            </TitleBarButton>
                        )}
                        <div
                            className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-[var(--mm-bg-active)] text-[9px] font-bold leading-none text-[var(--mm-text-on-active)]"
                            aria-hidden="true"
                        >
                            π
                        </div>
                        <span className="truncate text-[12px] text-[var(--mm-text-primary)]">
                            {title}
                        </span>
                    </>
                )}
            </div>

            {/* 中间 drag region */}
            <div className="flex flex-1 items-center justify-center min-w-0" data-mmcode-region="titlebar-center" />

            {/* 右侧 */}
            <div
                className="flex h-full items-center"
                style={isMac ? ({ WebkitAppRegion: "no-drag" } as React.CSSProperties) : undefined}
                data-mmcode-region="titlebar-right"
            >
                {!isMac && (
                    <>
                        {onToggleRight && (
                            <TitleBarButton
                                ariaLabel={rightCollapsed ? "展开右侧栏" : "折叠右侧栏"}
                                onClick={onToggleRight}
                            >
                                {rightCollapsed ? <RightPanelCollapseIcon /> : <RightPanelCollapseIcon />}
                            </TitleBarButton>
                        )}
                        <TitleBarButton ariaLabel="最小化窗口" onClick={() => void window.piAPI?.windowMinimize()}>
                            <MinimizeIcon />
                        </TitleBarButton>
                        <TitleBarButton
                            ariaLabel={isMaximized ? "取消最大化" : "最大化"}
                            onClick={() => void window.piAPI?.windowToggleMaximize()}
                        >
                            {isMaximized ? <UnmaximizeIcon /> : <MaximizeIcon />}
                        </TitleBarButton>
                        <TitleBarButton
                            ariaLabel="关闭窗口"
                            onClick={() => void window.piAPI?.windowClose()}
                            className="hover:!bg-[#e81123] hover:!text-white"
                        >
                            <CloseIcon />
                        </TitleBarButton>
                    </>
                )}
            </div>
        </div>
    );
}

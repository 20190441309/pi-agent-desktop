// MiniMaxCodeTitleBar — 32px 顶部标题栏

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const MAC_TRAFFIC_LIGHT_RESERVE = 80;
const TITLEBAR_DRAG_THRESHOLD_PX = 5;
const TITLEBAR_DRAG_SUPPRESS_DOUBLE_CLICK_MS = 500;

interface TitlebarDragState {
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    started: boolean;
}

function isTitlebarControlTarget(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest(
        "button, a, input, textarea, select, [role='tab'], [data-window-drag-exclude='true']",
    ));
}

export interface MiniMaxCodeTitleBarProps {
    title?: string;
    subtitle?: string;
    statusLabel?: string;
    statusTone?: "idle" | "ready" | "busy" | "error";
    navigationSlot?: React.ReactNode;
    leftWidth?: number;
    variant?: "main" | "settings";
    className?: string;
    onClose?: () => void | Promise<void>;
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

const AppLogoIcon: React.FC<{ variant: "main" | "settings" }> = ({ variant }) => (
    <svg className={variant === "settings" ? "h-[22px] w-[22px]" : "relative top-[2px] h-[20px] w-[20px]"} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4l8-4.6Z" fill="#eaf4ff" stroke="#1684df" strokeWidth="1.5" />
        <path d="M12 6.7 16.6 9.35v5.3L12 17.3l-4.6-2.65v-5.3L12 6.7Z" stroke="#1684df" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2.1" fill="#1684df" />
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
        className={`flex h-[30px] w-[34px] items-center justify-center text-[var(--mm-text-tertiary)] transition-colors duration-150 hover:bg-[var(--mm-bg-hover)] focus:outline-none focus-visible:bg-[var(--mm-bg-hover)] rounded-[4px] ${className}`}
    >
        {children}
    </button>
);

export function MiniMaxCodeTitleBar({
    title,
    subtitle,
    statusLabel,
    statusTone = "idle",
    navigationSlot,
    leftWidth,
    variant = "main",
    className = "",
    onClose,
}: MiniMaxCodeTitleBarProps): React.JSX.Element {
    const { t } = useTranslation();
    const [isMaximized, setIsMaximized] = useState(false);
    const [platform, setPlatform] = useState<NodeJS.Platform | "browser">("browser");
    const titlebarRef = useRef<HTMLDivElement>(null);
    const dragStateRef = useRef<TitlebarDragState | null>(null);
    const dragFrameRef = useRef<number | null>(null);
    const dragMovePendingRef = useRef(false);
    const suppressDoubleClickUntilRef = useRef(0);

    useEffect(() => {
        if (typeof window === "undefined" || !window.nodeAPI) return;
        setPlatform(window.nodeAPI.platform);
        void window.piAPI?.windowIsMaximized().then(setIsMaximized);
        const unsub = window.piAPI?.onWindowMaximizeChanged((max) => setIsMaximized(max));
        return () => { if (typeof unsub === "function") unsub(); };
    }, []);

    const flushPendingDragMove = useCallback((): void => {
        if (!dragMovePendingRef.current) return;
        if (dragFrameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
            window.cancelAnimationFrame(dragFrameRef.current);
        }
        dragFrameRef.current = null;
        dragMovePendingRef.current = false;
        const drag = dragStateRef.current;
        if (drag?.started) {
            window.piAPI?.windowUpdateDrag(drag.lastX, drag.lastY);
        }
    }, []);

    const finishTitlebarDrag = useCallback((): void => {
        const drag = dragStateRef.current;
        if (!drag) return;
        flushPendingDragMove();
        if (drag.started) {
            suppressDoubleClickUntilRef.current = Date.now() + TITLEBAR_DRAG_SUPPRESS_DOUBLE_CLICK_MS;
            window.piAPI?.windowEndDrag();
        }
        const titlebar = titlebarRef.current;
        if (titlebar?.hasPointerCapture?.(drag.pointerId)) {
            titlebar.releasePointerCapture(drag.pointerId);
        }
        dragStateRef.current = null;
    }, [flushPendingDragMove]);

    const scheduleDragMove = useCallback((): void => {
        dragMovePendingRef.current = true;
        if (dragFrameRef.current !== null) return;
        if (typeof window.requestAnimationFrame !== "function") {
            flushPendingDragMove();
            return;
        }
        dragFrameRef.current = window.requestAnimationFrame(() => {
            dragFrameRef.current = null;
            dragMovePendingRef.current = false;
            const drag = dragStateRef.current;
            if (drag?.started) {
                window.piAPI?.windowUpdateDrag(drag.lastX, drag.lastY);
            }
        });
    }, [flushPendingDragMove]);

    useEffect(() => {
        const onWindowBlur = (): void => finishTitlebarDrag();
        window.addEventListener("blur", onWindowBlur);
        return () => {
            window.removeEventListener("blur", onWindowBlur);
            finishTitlebarDrag();
        };
    }, [finishTitlebarDrag]);

    const isMac = platform === "darwin";
    const leftPad = isMac ? MAC_TRAFFIC_LIGHT_RESERVE : 10;
    const statusColor =
        statusTone === "ready"
            ? "bg-[var(--color-success)]"
            : statusTone === "busy"
                ? "bg-[#f59e0b]"
                : statusTone === "error"
                ? "bg-[var(--color-error)]"
                : "bg-[var(--mm-text-tertiary)]";
    const showCenterMeta = Boolean(statusLabel || subtitle);

    return (
        <div
            ref={titlebarRef}
            style={{ height: "var(--mm-height-titlebar)" }}
            className={`app-region-no-drag flex w-full shrink-0 items-center border-b border-[var(--mm-border)] bg-[var(--mm-bg-sidebar)] select-none ${className}`}
            data-mmcode-region="titlebar"
            role="banner"
            aria-label="window title bar"
            onPointerDown={(event) => {
                if (event.button !== 0 || isTitlebarControlTarget(event.target)) return;
                dragStateRef.current = {
                    pointerId: event.pointerId,
                    startX: event.screenX,
                    startY: event.screenY,
                    lastX: event.screenX,
                    lastY: event.screenY,
                    started: false,
                };
            }}
            onPointerMove={(event) => {
                const drag = dragStateRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                if (event.buttons === 0) {
                    finishTitlebarDrag();
                    return;
                }
                drag.lastX = event.screenX;
                drag.lastY = event.screenY;
                if (!drag.started) {
                    const deltaX = event.screenX - drag.startX;
                    const deltaY = event.screenY - drag.startY;
                    if (Math.hypot(deltaX, deltaY) < TITLEBAR_DRAG_THRESHOLD_PX) return;
                    drag.started = true;
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    window.piAPI?.windowBeginDrag(drag.startX, drag.startY);
                }
                scheduleDragMove();
            }}
            onPointerUp={finishTitlebarDrag}
            onPointerCancel={finishTitlebarDrag}
            onDoubleClick={(event) => {
                if (isTitlebarControlTarget(event.target)) return;
                if (Date.now() < suppressDoubleClickUntilRef.current) return;
                void window.piAPI?.windowToggleMaximize();
            }}
        >
            {/* 左侧 */}
            <div
                style={{ width: isMac ? leftPad : leftWidth ?? "var(--mm-width-sidebar-left)", flexShrink: 0 }}
                className={variant === "settings"
                    ? "flex h-full items-center gap-1 px-2"
                    : "relative top-[4px] flex h-full items-center gap-[8px] pl-[17px] pr-2"}
                data-mmcode-region="titlebar-left"
            >
                {!isMac && (
                    <>
                        <AppLogoIcon variant={variant} />
                        <span className="truncate text-[15px] font-medium text-[var(--mm-text-primary)]">
                            {title}
                        </span>
                    </>
                )}
            </div>

            {/* 中间 drag region */}
            <div
                className="flex h-full min-w-0 flex-1 items-center px-2"
                data-mmcode-region="titlebar-center"
            >
                {navigationSlot ?? (showCenterMeta && (
                    <div className="pi-motion-status-pill flex min-w-0 items-center gap-2 rounded-full border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] px-2.5 py-1 text-[11px] text-[var(--mm-text-secondary)]" data-motion-state={statusTone}>
                        {statusLabel && (
                            <span className="flex shrink-0 items-center gap-1.5">
                                <span className={`h-1.5 w-1.5 rounded-full ${statusTone === "busy" ? "pi-motion-running-dot" : ""} ${statusColor}`} aria-hidden="true" />
                                <span key={statusLabel} className="pi-motion-status-text">{statusLabel}</span>
                            </span>
                        )}
                        {subtitle && (
                            <>
                                {statusLabel && <span className="text-[var(--mm-text-tertiary)]">·</span>}
                                <span className="truncate font-mono">{subtitle}</span>
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* 右侧 */}
            <div
                className="flex h-full items-center gap-0.5 pr-[5px]"
                style={isMac ? ({ WebkitAppRegion: "no-drag" } as React.CSSProperties) : undefined}
                data-mmcode-region="titlebar-right"
            >
                {!isMac && (
                    <>
                        <TitleBarButton ariaLabel={t("titlebar.minimize")} onClick={() => void window.piAPI?.windowMinimize()}>
                            <MinimizeIcon />
                        </TitleBarButton>
                        <TitleBarButton
                            ariaLabel={isMaximized ? t("titlebar.restore") : t("titlebar.maximize")}
                            onClick={() => void window.piAPI?.windowToggleMaximize()}
                        >
                            {isMaximized ? <UnmaximizeIcon /> : <MaximizeIcon />}
                        </TitleBarButton>
                        <TitleBarButton
                            ariaLabel={t("titlebar.close")}
                            onClick={() => {
                                if (onClose) {
                                    void onClose();
                                    return;
                                }
                                void window.piAPI?.windowClose();
                            }}
                            className="hover:!bg-[#e81123] hover:!text-white focus-visible:!bg-[#e81123] focus-visible:!text-white"
                        >
                            <CloseIcon />
                        </TitleBarButton>
                    </>
                )}
            </div>
        </div>
    );
}

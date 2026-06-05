// Popover — 简单 click-to-toggle 下拉
// 用途:v1.0.13 给 ChatInput 3 个假按钮(权限/模型/...) 替换为真下拉
// 设计:不复制 UI,只复用 MiniMaxCode 风格 token(白底 + 阴影 + 圆角 8px + 1px 边框)
// 行为:
//  - trigger 点击切换 open
//  - 点 outside 关闭
//  - ESC 关闭
//  - portal 到 body,bypass 父容器 overflow:hidden
//  - 简单 absolute 定位:trigger 下方,左对齐(start) 或右对齐(end)

import React, { cloneElement, useCallback, useEffect, useRef, useState, isValidElement } from "react";
import { createPortal } from "react-dom";

export interface PopoverProps {
    /** 触发元素 — 必须是能接受 ref 的 React 元素(button/div) */
    trigger: React.ReactNode;
    /** 下拉内容 */
    children: React.ReactNode | ((close: () => void) => React.ReactNode);
    /** 水平对齐:start(左对齐 trigger) | end(右对齐 trigger) */
    align?: "start" | "end";
    /** 内容区附加 className */
    contentClassName?: string;
}

interface Position {
    top: number;
    left: number;
    width: number;
    viewport: { vh: number; vw: number; margin: number };
}

export function Popover({
    trigger,
    children,
    align = "start",
    contentClassName = "",
}: PopoverProps): React.JSX.Element {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<Position | null>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);

    // 计算位置:trigger 下方,左/右对齐
    // v1.0.13:viewport 适配 — 优先下方,空间不够翻上方;content 自身 max-height 限
    // 注: side prop 当前未使用(只支持 bottom),从 deps 删掉避免 exhaustive-deps warning
    const updatePosition = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const margin = 8;
        // 估算 content 高度(未知) — 用 240 上限,实际渲染后会用真高度做最终 clamp
        const estimatedHeight = 240;
        const preferBottom = rect.bottom + 4 + estimatedHeight + margin < vh;
        const top = preferBottom ? rect.bottom + 4 : Math.max(margin, rect.top - 4 - estimatedHeight);
        const left = align === "end" ? rect.right : rect.left;
        setPos({ top, left, width: rect.width, viewport: { vh, vw, margin } });
    }, [align]);

    // 点击 trigger 切换
    const handleTriggerClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            if (open) {
                setOpen(false);
            } else {
                updatePosition();
                setOpen(true);
            }
        },
        [open, updatePosition],
    );

    // 点 outside / ESC 关闭
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent): void => {
            const t = e.target as Node | null;
            if (!t) return;
            if (contentRef.current?.contains(t)) return;
            if (triggerRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    // 滚动/resize 时关掉(简化:不重定位,直接关)
    useEffect(() => {
        if (!open) return;
        const close = (): void => setOpen(false);
        window.addEventListener("resize", close);
        window.addEventListener("scroll", close, true);
        return () => {
            window.removeEventListener("resize", close);
            window.removeEventListener("scroll", close, true);
        };
    }, [open]);

    // 注入 ref + onClick 到 trigger
    const triggerWithRef = isValidElement(trigger)
        ? cloneElement(trigger as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void; ref?: React.Ref<HTMLElement> }>, {
              ref: (el: HTMLElement | null) => {
                  triggerRef.current = el;
              },
              onClick: handleTriggerClick,
          })
        : trigger;

    const content = (
        <div
            ref={contentRef}
            role="menu"
            className={`fixed z-[60] min-w-[180px] bg-[var(--mm-bg-sidebar)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 overflow-y-auto ${contentClassName}`}
            style={
                pos
                    ? {
                          top: pos.top,
                          // 高度限:不超出 viewport 上下边界
                          maxHeight: pos.viewport.vh - pos.top - pos.viewport.margin,
                          ...(align === "end" ? { right: pos.viewport.vw - pos.left } : { left: pos.left }),
                      }
                    : { visibility: "hidden" }
            }
        >
            {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
    );

    return (
        <>
            {triggerWithRef}
            {open && typeof document !== "undefined" && createPortal(content, document.body)}
        </>
    );
}

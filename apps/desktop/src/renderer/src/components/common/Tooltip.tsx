// Tooltip (可用度-C)
// 简单的 hover/focus tooltip 组件, IconBar 侧栏用
// 特点: 纯 CSS 定位 (右侧弹出, 避免 48px 宽栏位被裁), hover/focus 都触发, 150ms 延迟
// v1.0.10 (M2): timer 改 useRef, 避免组件 re-render 丢失旧 setTimeout 句柄

import React, { useEffect, useId, useRef, useState } from "react";

export interface TooltipProps {
    /** 显示文本 (必填) */
    label: string;
    /** 触发元素 */
    children: React.ReactElement;
    /** 显示位置, 默认 right (适合侧栏) */
    side?: "right" | "left" | "top" | "bottom";
    /** 出现延迟 (ms) */
    delay?: number;
}

/**
 * Tooltip 包装触发元素, 在 hover/focus 时显示文本.
 *
 * 不使用 Portal, 简单 relative/absolute 定位, 仅适合 trigger 周围有空间的情况.
 * 复杂场景 (overflow:hidden 等) 改用 @floating-ui/react 这种重武器.
 */
export function Tooltip({
    label,
    children,
    side = "right",
    delay = 200,
}: TooltipProps): React.ReactElement {
    const [visible, setVisible] = useState(false);
    const id = useId();
    // v1.0.10 (M2): 用 ref 持有 timer, 跨 render 保持稳定, 防止 mouseEnter/mouseLeave
    // 紧挨着触发时, 旧 setTimeout 句柄丢失导致延迟 show 仍触发 → tooltip 闪烁
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = (): void => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setVisible(true), delay);
    };
    const hide = (): void => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisible(false);
    };

    // 组件 unmount 时清理 pending timer, 避免 setState on unmounted
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    // 注入 props 到 children (用 React.cloneElement 避免 children 自己管理这些事件)
    // children 类型是泛型 React.ReactElement, props 推断为 unknown, 这里 cast 到标准 HTML attrs
    const typedChild = children as React.ReactElement<
        React.HTMLAttributes<HTMLElement> & {
            onMouseEnter?: React.MouseEventHandler<HTMLElement>;
            onMouseLeave?: React.MouseEventHandler<HTMLElement>;
            onFocus?: React.FocusEventHandler<HTMLElement>;
            onBlur?: React.FocusEventHandler<HTMLElement>;
        }
    >;
    const childProps = typedChild.props ?? {};
    const trigger = React.cloneElement(typedChild, {
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
            show();
            childProps.onMouseEnter?.(e);
        },
        onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
            hide();
            childProps.onMouseLeave?.(e);
        },
        onFocus: (e: React.FocusEvent<HTMLElement>) => {
            show();
            childProps.onFocus?.(e);
        },
        onBlur: (e: React.FocusEvent<HTMLElement>) => {
            hide();
            childProps.onBlur?.(e);
        },
        "aria-describedby": visible ? id : undefined,
    });

    const positionClass = ((): string => {
        switch (side) {
            case "left":
                return "right-full mr-2 top-1/2 -translate-y-1/2";
            case "top":
                return "bottom-full mb-2 left-1/2 -translate-x-1/2";
            case "bottom":
                return "top-full mt-2 left-1/2 -translate-x-1/2";
            case "right":
            default:
                return "left-full ml-2 top-1/2 -translate-y-1/2";
        }
    })();

    return (
        <span className="relative inline-flex">
            {trigger}
            {visible && (
                <span
                    id={id}
                    role="tooltip"
                    className={`pointer-events-none absolute z-50 ${positionClass} px-1.5 py-0.5 bg-[#1a1a1a] text-white text-[11px] font-medium rounded whitespace-nowrap shadow-md animate-fade-in`}
                >
                    {label}
                </span>
            )}
        </span>
    );
}

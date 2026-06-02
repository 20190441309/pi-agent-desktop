// Tooltip (可用度-C)
// 简单的 hover/focus tooltip 组件, IconBar 侧栏用
// 特点: 纯 CSS 定位 (右侧弹出, 避免 48px 宽栏位被裁), hover/focus 都触发, 150ms 延迟

import React, { useId, useState } from "react";

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
    let timer: ReturnType<typeof setTimeout> | null = null;

    const show = (): void => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => setVisible(true), delay);
    };
    const hide = (): void => {
        if (timer) clearTimeout(timer);
        setVisible(false);
    };

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

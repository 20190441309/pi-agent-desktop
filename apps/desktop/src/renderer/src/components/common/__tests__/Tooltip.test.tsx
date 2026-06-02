// Tooltip 组件测试 (可用度-C)
// 注意:
// - Tooltip 用 React.cloneElement 把 onMouseEnter/onMouseLeave/onFocus/onBlur 注入到 children 上,
//   handler 实际在 BUTTON 上, 不在 wrapper span 上. React 的 onMouseEnter 不冒泡.
// - fake timer 下 setState 要在 act() 内推进; 真实 timer 下要 waitFor 等下一个 microtask.
// - 项目未装 @testing-library/jest-dom, 不用 toHaveTextContent, 改用 .textContent 比对.

// @vitest-environment jsdom

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";
import { Tooltip } from "../Tooltip";

describe("Tooltip", () => {
    it("默认不显示 tooltip", () => {
        render(
            <Tooltip label="hi">
                <button>trigger</button>
            </Tooltip>,
        );
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("hover 后 (经过 delay) 显示 tooltip", () => {
        vi.useFakeTimers();
        try {
            render(
                <Tooltip label="hello" delay={100}>
                    <button>trigger</button>
                </Tooltip>,
            );
            // handler 在 button (children) 上, 必须在 button 上触发
            const btn = screen.getByText("trigger");
            fireEvent.mouseEnter(btn);
            act(() => {
                vi.advanceTimersByTime(150);
            });
            const tip = screen.getByRole("tooltip");
            expect(tip.textContent).toBe("hello");
        } finally {
            vi.useRealTimers();
        }
    });

    it("mouse leave 隐藏 tooltip", () => {
        render(
            <Tooltip label="hi" delay={0}>
                <button>trigger</button>
            </Tooltip>,
        );
        const btn = screen.getByText("trigger");
        fireEvent.mouseEnter(btn);
        fireEvent.mouseLeave(btn);
        // setTimeout(0) 被同步 clearTimeout, 不会 setVisible(true)
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("focus 也触发 tooltip (键盘可访问)", async () => {
        render(
            <Tooltip label="hi" delay={0}>
                <button>trigger</button>
            </Tooltip>,
        );
        const btn = screen.getByText("trigger");
        fireEvent.focus(btn);
        // setTimeout(0) + React 19 异步 setState, 等 microtask
        await waitFor(() => {
            expect(screen.getByRole("tooltip").textContent).toBe("hi");
        });
    });

    it("不破坏 children 已有的 onClick", () => {
        const onClick = vi.fn();
        render(
            <Tooltip label="x">
                <button onClick={onClick}>trigger</button>
            </Tooltip>,
        );
        fireEvent.click(screen.getByText("trigger"));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});

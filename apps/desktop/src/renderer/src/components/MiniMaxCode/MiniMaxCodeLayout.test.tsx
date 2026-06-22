// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MiniMaxCodeLayout } from "./MiniMaxCodeLayout";
import { MiniMaxCodeTitleBar } from "./MiniMaxCodeTitleBar";

describe("MiniMaxCode window chrome interactivity", () => {
    it("marks titlebar navigation slot as no-drag so tabs receive clicks in Electron", () => {
        render(
            <MiniMaxCodeTitleBar
                title="Pi Agent"
                navigationSlot={<button type="button">对话</button>}
            />,
        );

        const titlebarCenter = screen.getByRole("button", { name: "对话" }).closest('[data-mmcode-region="titlebar-center"]');

        expect(titlebarCenter?.className ?? "").toContain("app-region-no-drag");
    });

    it("keeps the global composer root scoped to the center workspace", () => {
        render(
            <MiniMaxCodeLayout
                leftSlot={<div />}
                centerSlot={<div />}
                rightSlot={null}
            />,
        );

        expect(document.getElementById("pi-global-composer-root")?.className ?? "").toContain("pointer-events-auto");
        expect(document.getElementById("pi-global-composer-root")?.className ?? "").not.toContain("inset-x-0");
        expect(document.getElementById("pi-global-composer-root")?.className ?? "").toContain("left-0");
        expect(document.getElementById("pi-global-composer-root")?.className ?? "").toContain("right-0");
        expect(document.querySelector('[data-mmcode-region="center"]')?.querySelector("#pi-global-composer-root")).toBeTruthy();
    });

    it("pins sidebar collapse controls to the window edges and reserves content gutters", () => {
        render(
            <MiniMaxCodeLayout
                leftSlot={<div>对话</div>}
                centerSlot={<div />}
                rightSlot={<div>环境信息</div>}
                rightFloatingOpen
                onCollapseLeft={() => undefined}
                onCollapseRight={() => undefined}
            />,
        );

        expect(screen.getByRole("button", { name: "折叠左侧栏" }).className).toContain("top-4");
        expect(screen.getByRole("button", { name: "折叠右侧栏" }).className).toContain("top-4");
        expect(screen.getByRole("button", { name: "折叠左侧栏" }).className).toContain("left-3");
        expect(screen.getByRole("button", { name: "折叠右侧栏" }).className).toContain("right-3");
        expect(screen.getByRole("button", { name: "折叠左侧栏" }).className).toContain("z-[80]");
        expect(screen.getByRole("button", { name: "折叠右侧栏" }).className).toContain("z-[80]");
        expect(screen.getByRole("button", { name: "折叠左侧栏" }).className).not.toContain("top-1/2");
        expect(screen.getByRole("button", { name: "折叠右侧栏" }).className).not.toContain("top-1/2");
        expect(screen.getByRole("button", { name: "折叠左侧栏" }).className).not.toContain("-translate-y-1/2");
        expect(screen.getByRole("button", { name: "折叠右侧栏" }).className).not.toContain("-translate-y-1/2");
        expect(document.querySelector('[data-mmcode-region="left"]')?.firstElementChild?.className ?? "").toContain("pl-10");
        expect(document.querySelector('[data-mmcode-region="right-floating"]')?.className ?? "").toContain("absolute");
    });

    it("reserves center gutters when a sidebar is collapsed and omits unavailable right toggle", () => {
        render(
            <MiniMaxCodeLayout
                leftSlot={<div>对话</div>}
                centerSlot={<div>主内容</div>}
                rightSlot={null}
                leftCollapsed
                rightCollapsed
                onCollapseLeft={() => undefined}
            />,
        );

        expect(screen.getByRole("button", { name: "展开左侧栏" }).className).toContain("left-3");
        expect(screen.queryByRole("button", { name: "展开右侧栏" })).toBeNull();
        expect(document.querySelector('[data-mmcode-region="center"]')?.className ?? "").toContain("pl-10");
    });

    it("uses the provided sidebar width for both body and titlebar", () => {
        render(
            <MiniMaxCodeLayout
                leftSlot={<div>对话</div>}
                centerSlot={<div>主内容</div>}
                rightSlot={null}
                leftWidth={260}
            />,
        );

        expect((document.querySelector('[data-mmcode-region="left"]') as HTMLElement).style.width).toBe("260px");
        expect((document.querySelector('[data-mmcode-region="titlebar-left"]') as HTMLElement).style.width).toBe("260px");
    });

    it("clamps drag resizing to the supported left sidebar width range", () => {
        const onLeftWidthChange = vi.fn();
        render(
            <MiniMaxCodeLayout
                leftSlot={<div>对话</div>}
                centerSlot={<div>主内容</div>}
                rightSlot={null}
                leftWidth={190}
                onLeftWidthChange={onLeftWidthChange}
            />,
        );

        const handle = screen.getByRole("separator", { name: "调整左侧栏宽度" });
        fireEvent.pointerDown(handle, { clientX: 190, pointerId: 1 });
        fireEvent.pointerMove(window, { clientX: 420, pointerId: 1 });
        fireEvent.pointerUp(window, { pointerId: 1 });

        expect(onLeftWidthChange).toHaveBeenCalledWith(320);
    });

    it("renders the right rail as a floating workspace panel instead of a layout column", () => {
        render(
            <MiniMaxCodeLayout
                leftSlot={<div>对话</div>}
                centerSlot={<div>主内容</div>}
                rightSlot={<div>环境信息</div>}
                rightFloatingOpen
                onCollapseRight={() => undefined}
            />,
        );

        expect(document.querySelector('[data-mmcode-region="right"]')).toBeNull();
        expect(document.querySelector('[data-mmcode-region="right-floating"]')?.textContent).toContain("环境信息");
        expect(document.querySelector('[data-mmcode-region="center"]')?.className ?? "").not.toContain("pr-10");
    });

    it("keeps the floating right rail above the global composer layer", () => {
        render(
            <MiniMaxCodeLayout
                leftSlot={<div>对话</div>}
                centerSlot={<div>主内容</div>}
                rightSlot={<div>环境信息</div>}
                rightFloatingOpen
            />,
        );

        const composerClass = document.getElementById("pi-global-composer-root")?.className ?? "";
        const rightFloatingClass = document.querySelector('[data-mmcode-region="right-floating"]')?.className ?? "";

        expect(composerClass).toContain("z-30");
        expect(rightFloatingClass).toContain("z-[60]");
    });
});

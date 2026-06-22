// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

    it("keeps the global composer root interactive for portal-mounted controls", () => {
        render(
            <MiniMaxCodeLayout
                leftSlot={<div />}
                centerSlot={<div />}
                rightSlot={null}
            />,
        );

        expect(document.getElementById("pi-global-composer-root")?.className ?? "").toContain("pointer-events-auto");
    });

    it("pins sidebar collapse controls to the window edges and reserves content gutters", () => {
        render(
            <MiniMaxCodeLayout
                leftSlot={<div>对话</div>}
                centerSlot={<div />}
                rightSlot={<div>环境信息</div>}
                onCollapseLeft={() => undefined}
                onCollapseRight={() => undefined}
            />,
        );

        expect(screen.getByRole("button", { name: "折叠左侧栏" }).className).toContain("top-4");
        expect(screen.getByRole("button", { name: "折叠右侧栏" }).className).toContain("top-4");
        expect(screen.getByRole("button", { name: "折叠左侧栏" }).className).toContain("left-2");
        expect(screen.getByRole("button", { name: "折叠右侧栏" }).className).toContain("right-2");
        expect(screen.getByRole("button", { name: "折叠左侧栏" }).className).not.toContain("top-1/2");
        expect(screen.getByRole("button", { name: "折叠右侧栏" }).className).not.toContain("top-1/2");
        expect(screen.getByRole("button", { name: "折叠左侧栏" }).className).not.toContain("-translate-y-1/2");
        expect(screen.getByRole("button", { name: "折叠右侧栏" }).className).not.toContain("-translate-y-1/2");
        expect(document.querySelector('[data-mmcode-region="left"]')?.firstElementChild?.className ?? "").toContain("pl-10");
        expect(document.querySelector('[data-mmcode-region="right"]')?.firstElementChild?.className ?? "").toContain("pr-10");
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

        expect(screen.getByRole("button", { name: "展开左侧栏" }).className).toContain("left-2");
        expect(screen.queryByRole("button", { name: "展开右侧栏" })).toBeNull();
        expect(document.querySelector('[data-mmcode-region="center"]')?.className ?? "").toContain("pl-10");
    });
});

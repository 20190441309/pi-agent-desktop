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

    it("places sidebar collapse controls near the top edge and aligned with side content", () => {
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
        expect(screen.getByRole("button", { name: "折叠左侧栏" }).className).not.toContain("top-1/2");
        expect(screen.getByRole("button", { name: "折叠右侧栏" }).className).not.toContain("top-1/2");
        expect(screen.getByRole("button", { name: "折叠左侧栏" }).className).not.toContain("-translate-y-1/2");
        expect(screen.getByRole("button", { name: "折叠右侧栏" }).className).not.toContain("-translate-y-1/2");
    });
});

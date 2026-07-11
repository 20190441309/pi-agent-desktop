// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const openMock = vi.fn((element: HTMLElement | null) => {
    if (!element) throw new Error("terminal container missing");
});
const disposeMock = vi.fn();
const writeMock = vi.fn();
const loadAddonMock = vi.fn();
const onDataMock = vi.fn();
const fitMock = vi.fn();

vi.mock("@xterm/xterm", () => ({
    Terminal: vi.fn(function TerminalMock() {
        return {
        cols: 80,
        rows: 24,
        open: openMock,
        dispose: disposeMock,
        write: writeMock,
        loadAddon: loadAddonMock,
        onData: onDataMock,
        };
    }),
}));

vi.mock("@xterm/addon-fit", () => ({
    FitAddon: vi.fn(function FitAddonMock() {
        return { fit: fitMock };
    }),
}));

vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

import { TerminalPanel } from "./TerminalPanel";

const unsubOut = vi.fn();
const unsubExit = vi.fn();

describe("TerminalPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        class ResizeObserverStub {
            observe = vi.fn();
            disconnect = vi.fn();
        }
        Object.defineProperty(window, "ResizeObserver", {
            value: ResizeObserverStub,
            configurable: true,
        });
        Object.defineProperty(window, "piAPI", {
            value: {
                createTerminal: vi.fn(async ({ id }: { id: string }) => ({ id, cwd: "C:/demo", cols: 80, rows: 24 })),
                terminalInput: vi.fn(async () => undefined),
                terminalResize: vi.fn(async () => undefined),
                closeTerminal: vi.fn(async () => undefined),
                onTerminalOutput: vi.fn(() => unsubOut),
                onTerminalExit: vi.fn(() => unsubExit),
            },
            configurable: true,
        });
    });

    it("opens the xterm after the container is mounted and cleans subscriptions on close", async () => {
        render(<TerminalPanel isOpen workspacePath="C:/demo" onClose={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "+ 新建终端" }));

        await waitFor(() => {
            expect(openMock).toHaveBeenCalledWith(expect.any(HTMLElement));
        });
        await waitFor(() => {
            expect(window.piAPI.createTerminal).toHaveBeenCalledTimes(1);
        });

        fireEvent.click(screen.getByRole("button", { name: "关闭终端 Terminal 1" }));

        expect(unsubOut).toHaveBeenCalledTimes(1);
        expect(unsubExit).toHaveBeenCalledTimes(1);
        expect(disposeMock).toHaveBeenCalledTimes(1);
        expect(window.piAPI.closeTerminal).toHaveBeenCalledTimes(1);
    });

    it("fills the workbench surface and hides the overlay close control when embedded", () => {
        render(
            <TerminalPanel
                isOpen
                workspacePath="C:/demo"
                onClose={vi.fn()}
                displayMode="embedded"
            />,
        );

        const panel = screen.getByTestId("terminal-panel");
        expect(panel.className).toContain("h-full");
        expect(panel.className).not.toContain("h-64");
        expect(screen.queryByTitle("收起终端")).toBeNull();
    });

    it("states that the user-controlled terminal keeps full local access", () => {
        render(<TerminalPanel isOpen workspacePath="C:/demo" onClose={vi.fn()} />);

        expect(screen.getByRole("note").textContent).toContain("终端由你直接控制，拥有本机完整权限；Agent 工具权限不会限制此终端");
        expect(screen.getByRole("note").className).not.toContain("hidden");
    });
});

// @vitest-environment jsdom

import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../i18n";
import { PiAgentTab } from "./PiAgentTab";

vi.mock("../../PiStatusPanel", () => ({
    PiStatusPanel: () => <div data-testid="pi-status-panel">PiStatusPanel</div>,
}));

describe("PiAgentTab", () => {
    beforeEach(() => {
        window.localStorage.setItem("pi-desktop.locale", "zh-CN");
    });

    it("reloads the full Pi config after a pi-config change event", async () => {
        let onPiConfigChanged: (() => void) | undefined;
        const getFullConfig = vi.fn()
            .mockResolvedValueOnce({
                configPath: "C:/Users/demo/.pi/agent",
                defaultProvider: "mimo",
                defaultModel: "mimo-v2.5",
                providers: [{ id: "mimo", name: "MiMo", baseUrl: "https://mimo.example", modelCount: 1, hasApiKey: true }],
            })
            .mockResolvedValueOnce({
                configPath: "C:/Users/demo/.pi/agent",
                defaultProvider: "longcat",
                defaultModel: "longcat-preview",
                providers: [{ id: "longcat", name: "LongCat", baseUrl: "https://longcat.example", modelCount: 1, hasApiKey: true }],
            });

        Object.assign(window, {
            piAPI: {
                getFullConfig,
                onPiConfigChanged: vi.fn((cb: () => void) => {
                    onPiConfigChanged = cb;
                    return vi.fn();
                }),
            },
        });

        render(
            <I18nProvider>
                <PiAgentTab />
            </I18nProvider>,
        );

        expect(await screen.findByText("mimo-v2.5")).toBeTruthy();

        await act(async () => {
            onPiConfigChanged?.();
        });

        await waitFor(() => {
            expect(screen.getByText("longcat-preview")).toBeTruthy();
        });
        expect(getFullConfig).toHaveBeenCalledTimes(2);
    });

    it("reloads the full Pi config when the reused window regains focus", async () => {
        const getFullConfig = vi.fn()
            .mockResolvedValueOnce({
                configPath: "C:/Users/demo/.pi/agent",
                defaultProvider: "mimo",
                defaultModel: "mimo-v2.5",
                providers: [],
            })
            .mockResolvedValueOnce({
                configPath: "C:/Users/demo/.pi/agent",
                defaultProvider: "longcat",
                defaultModel: "longcat-preview",
                providers: [],
            });

        Object.assign(window, {
            piAPI: {
                getFullConfig,
                onPiConfigChanged: vi.fn(() => vi.fn()),
            },
        });

        render(
            <I18nProvider>
                <PiAgentTab />
            </I18nProvider>,
        );

        expect(await screen.findByText("mimo-v2.5")).toBeTruthy();

        act(() => {
            window.dispatchEvent(new Event("focus"));
        });

        await waitFor(() => {
            expect(screen.getByText("longcat-preview")).toBeTruthy();
        });
        expect(getFullConfig).toHaveBeenCalledTimes(2);
    });
});

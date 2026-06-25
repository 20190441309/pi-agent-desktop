import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAppSettings, type AppSettings } from "@shared";

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const sendSpy = vi.fn();

vi.mock("electron", () => ({
    BrowserWindow: {
        getAllWindows: vi.fn(() => [
            {
                isDestroyed: () => false,
                webContents: {
                    send: sendSpy,
                },
            },
        ]),
    },
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers.set(channel, handler);
        }),
        on: vi.fn(),
    },
}));

vi.mock("electron-log/main", () => ({
    default: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

import { setupSettingsIpc } from "../settings.ipc";

function createSettingsStore(seed?: Partial<AppSettings>) {
    let settings = seed as AppSettings;
    return {
        get: vi.fn((_key: "settings") => settings),
        set: vi.fn((_key: "settings", value: AppSettings) => {
            settings = value;
        }),
    };
}

describe("settings.ipc", () => {
    beforeEach(() => {
        handlers.clear();
        sendSpy.mockReset();
    });

    it("normalizes legacy settings on get", async () => {
        const store = createSettingsStore({
            theme: "dark",
            fontSize: 16,
            model: "",
            provider: "",
            temperature: 0.7,
            maxTokens: 4096,
            autoSave: true,
            showLineNumbers: true,
            wordWrap: true,
        });
        setupSettingsIpc({
            store,
            getPiAgentConfig: () => null,
            piAgentDir: "C:/Users/demo/.pi/agent",
        });

        const handler = handlers.get("settings:get");
        const result = await handler?.();

        expect(result).toEqual(expect.objectContaining({
            showThinking: true,
            thinkingLevel: "medium",
            visionProvider: "",
            visionModel: "",
        }));
    });

    it("persists and broadcasts the renderer-only thinking and vision fields", async () => {
        const store = createSettingsStore(resolveAppSettings());
        setupSettingsIpc({
            store,
            getPiAgentConfig: () => null,
            piAgentDir: "C:/Users/demo/.pi/agent",
        });

        const handler = handlers.get("settings:set");
        const result = await handler?.({}, {
            showThinking: false,
            thinkingLevel: "high",
            visionProvider: "minimax",
            visionModel: "MiniMax-VL",
        });

        expect(store.set).toHaveBeenCalledWith("settings", expect.objectContaining({
            showThinking: false,
            thinkingLevel: "high",
            visionProvider: "minimax",
            visionModel: "MiniMax-VL",
        }));
        expect(sendSpy).toHaveBeenCalledWith("settings:changed", expect.objectContaining({
            showThinking: false,
            thinkingLevel: "high",
            visionProvider: "minimax",
            visionModel: "MiniMax-VL",
        }));
        expect(result).toEqual(expect.objectContaining({
            showThinking: false,
            thinkingLevel: "high",
            visionProvider: "minimax",
            visionModel: "MiniMax-VL",
        }));
    });
});

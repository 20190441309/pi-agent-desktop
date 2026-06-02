// settings-store 测试 (v1.0.9)
// 覆盖: 初始状态 / open/close / updateSettings 走 IpcError 路径 / resetSettings / clearWriteError

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ipcError } from "@shared";
import type { AppSettings } from "@shared";

// mock window.piAPI; 每个 case 单独覆盖
const mockApi = {
    getSettings: vi.fn(),
    setSettings: vi.fn(),
    loadPiConfig: vi.fn(),
};

beforeEach(() => {
    (globalThis as { window: unknown }).window = { piAPI: mockApi };
    vi.clearAllMocks();
});

// store 顶层会调 getSettings() (loadSettings), mock 默认返 {}
mockApi.getSettings.mockResolvedValue({});

import { useSettingsStore } from "../settings-store";

describe("settings-store: 初始状态", () => {
    it("默认 settings 是 defaultSettings", () => {
        useSettingsStore.setState({
            settings: {
                theme: "light", fontSize: 14, model: "gpt-4", provider: "openai",
                temperature: 0.7, maxTokens: 4096, autoSave: true,
                showLineNumbers: true, wordWrap: true,
            },
            isOpen: false,
            piModels: null,
            lastWriteError: null,
        });
        const s = useSettingsStore.getState();
        expect(s.isOpen).toBe(false);
        expect(s.settings.theme).toBe("light");
        expect(s.lastWriteError).toBeNull();
    });
});

describe("settings-store: open / close / toggle", () => {
    it("openSettings → isOpen=true", () => {
        useSettingsStore.setState({ isOpen: false });
        useSettingsStore.getState().openSettings();
        expect(useSettingsStore.getState().isOpen).toBe(true);
    });

    it("closeSettings → isOpen=false", () => {
        useSettingsStore.setState({ isOpen: true });
        useSettingsStore.getState().closeSettings();
        expect(useSettingsStore.getState().isOpen).toBe(false);
    });

    it("toggleSettings 翻 isOpen", () => {
        useSettingsStore.setState({ isOpen: false });
        useSettingsStore.getState().toggleSettings();
        expect(useSettingsStore.getState().isOpen).toBe(true);
        useSettingsStore.getState().toggleSettings();
        expect(useSettingsStore.getState().isOpen).toBe(false);
    });
});

describe("settings-store: updateSettings 走 IPC 错误路径", () => {
    it("成功: 调 setSettings, lastWriteError 保持 null", async () => {
        mockApi.setSettings.mockResolvedValue({});
        useSettingsStore.setState({ lastWriteError: null });
        useSettingsStore.getState().updateSettings({ fontSize: 18 });
        // 等 microtask flush
        await Promise.resolve();
        await Promise.resolve();
        const s = useSettingsStore.getState();
        expect(s.settings.fontSize).toBe(18);
        expect(s.lastWriteError).toBeNull();
        expect(mockApi.setSettings).toHaveBeenCalledWith({ fontSize: 18 });
    });

    it("失败 (IpcError): 调 setSettings, lastWriteError 写入 IpcError", async () => {
        const err = ipcError("ipcErrors.settings.saveFailed", "保存失败: EACCES", { message: "EACCES" });
        mockApi.setSettings.mockResolvedValue(err);
        useSettingsStore.setState({ lastWriteError: null });
        useSettingsStore.getState().updateSettings({ fontSize: 18 });
        await Promise.resolve();
        await Promise.resolve();
        expect(useSettingsStore.getState().lastWriteError).toEqual(err);
    });

    it("老 throw 路径: setSettings 抛, lastWriteError 写入 string", async () => {
        mockApi.setSettings.mockRejectedValue(new Error("network down"));
        useSettingsStore.setState({ lastWriteError: null });
        useSettingsStore.getState().updateSettings({ fontSize: 18 });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        const s = useSettingsStore.getState();
        expect(typeof s.lastWriteError).toBe("string");
        expect(s.lastWriteError).toContain("network down");
    });
});

describe("settings-store: resetSettings 走 IPC 错误路径", () => {
    it("成功: 调 setSettings(defaultSettings)", async () => {
        mockApi.setSettings.mockResolvedValue({});
        useSettingsStore.setState({ lastWriteError: null });
        useSettingsStore.getState().resetSettings();
        await Promise.resolve();
        await Promise.resolve();
        expect(mockApi.setSettings).toHaveBeenCalled();
        expect(useSettingsStore.getState().settings.fontSize).toBe(14); // 复位到 default
    });

    it("失败 (IpcError): lastWriteError 写入", async () => {
        const err = ipcError("ipcErrors.settings.saveFailed", "重置失败", { message: "x" });
        mockApi.setSettings.mockResolvedValue(err);
        useSettingsStore.setState({ lastWriteError: null });
        useSettingsStore.getState().resetSettings();
        await Promise.resolve();
        await Promise.resolve();
        expect(useSettingsStore.getState().lastWriteError).toEqual(err);
    });
});

describe("settings-store: clearWriteError", () => {
    it("清 lastWriteError", () => {
        useSettingsStore.setState({ lastWriteError: "stale error" });
        useSettingsStore.getState().clearWriteError();
        expect(useSettingsStore.getState().lastWriteError).toBeNull();
    });
});

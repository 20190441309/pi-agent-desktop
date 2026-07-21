import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock("electron", () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers.set(channel, handler);
        }),
    },
}));

vi.mock("electron-log/main", () => ({
    default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

import { setupPiDriverIpc } from "../pi-driver.ipc";

type DriverStub = {
    detectSync: ReturnType<typeof vi.fn>;
    detect: ReturnType<typeof vi.fn>;
    install: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    uninstall: ReturnType<typeof vi.fn>;
    cancelOperation: ReturnType<typeof vi.fn>;
};

function createDriver(overrides: Partial<DriverStub> = {}): DriverStub {
    return {
        detectSync: vi.fn(() => ({
            installed: true,
            localVersion: "1.0.0",
            latestVersion: "1.0.0",
            updateAvailable: false,
            executablePath: "C:/pi/pi.cmd",
            installMethod: "managed",
            configExists: true,
            defaultProvider: null,
            defaultModel: null,
            managedRuntimePath: "C:/pi",
            runtimeSource: "managed",
            runtimeChannel: "stable",
            lastCheckedAt: Date.now(),
        })),
        detect: vi.fn(async () => ({ installed: true })),
        install: vi.fn(async () => undefined),
        update: vi.fn(async () => undefined),
        uninstall: vi.fn(async () => undefined),
        cancelOperation: vi.fn(),
        ...overrides,
    };
}

describe("setupPiDriverIpc (B-004/B-005/B-006 IPC contracts)", () => {
    beforeEach(() => {
        handlers.clear();
    });

    it("returns driverNotInitialized when PiDriver is unavailable", async () => {
        setupPiDriverIpc(() => null);
        const result = await handlers.get("pi:install")!({});
        expect(result).toMatchObject({
            code: "ipcErrors.pi.driverNotInitialized",
        });
    });

    it("install success path re-detects status after driver.install (B-004)", async () => {
        const driver = createDriver();
        setupPiDriverIpc(() => driver as never);

        const result = await handlers.get("pi:install")!({});

        expect(driver.install).toHaveBeenCalledTimes(1);
        expect(driver.detectSync).toHaveBeenCalled();
        expect(result).toMatchObject({ installed: true, installMethod: "managed" });
    });

    it("install failure returns structured installFailed without throwing (B-004)", async () => {
        const driver = createDriver({
            install: vi.fn(async () => {
                throw new Error("npm EACCES");
            }),
        });
        setupPiDriverIpc(() => driver as never);

        const result = await handlers.get("pi:install")!({});

        expect(result).toMatchObject({
            code: "ipcErrors.pi.installFailed",
            fallback: expect.stringContaining("npm EACCES"),
        });
    });

    it("update failure returns structured updateFailed (B-005)", async () => {
        const driver = createDriver({
            update: vi.fn(async () => {
                throw new Error("network down");
            }),
        });
        setupPiDriverIpc(() => driver as never);

        const result = await handlers.get("pi:update")!({});

        expect(result).toMatchObject({
            code: "ipcErrors.pi.updateFailed",
            fallback: expect.stringContaining("network down"),
        });
        expect(driver.detectSync).not.toHaveBeenCalled();
    });

    it("uninstall success re-detects and cancel-operation is fire-and-forget (B-006)", async () => {
        const driver = createDriver({
            detectSync: vi.fn(() => ({
                installed: false,
                localVersion: null,
                latestVersion: null,
                updateAvailable: false,
                executablePath: null,
                installMethod: "unknown",
                configExists: false,
                defaultProvider: null,
                defaultModel: null,
                managedRuntimePath: null,
                runtimeSource: "none",
                runtimeChannel: "stable",
                lastCheckedAt: Date.now(),
            })),
        });
        setupPiDriverIpc(() => driver as never);

        const result = await handlers.get("pi:uninstall")!({});
        expect(driver.uninstall).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ installed: false, executablePath: null });

        await handlers.get("pi:cancel-operation")!({});
        expect(driver.cancelOperation).toHaveBeenCalledTimes(1);
    });
});

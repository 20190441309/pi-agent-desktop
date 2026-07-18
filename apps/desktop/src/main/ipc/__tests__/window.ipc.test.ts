import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const listeners = new Map<string, (...args: unknown[]) => unknown>();
const webContentsSend = vi.fn();
const maximizeMock = vi.fn();
const unmaximizeMock = vi.fn();
const minimizeMock = vi.fn();
const closeMock = vi.fn();
const setBoundsMock = vi.fn();
const onMock = vi.fn();
const mockWebContents = {};
const mockWindow = {
  isDestroyed: vi.fn(() => false),
  isMaximized: vi.fn(() => false),
  minimize: minimizeMock,
  maximize: maximizeMock,
  unmaximize: unmaximizeMock,
  close: closeMock,
  getBounds: vi.fn(() => ({ x: 10, y: 20, width: 690, height: 756 })),
  setBounds: setBoundsMock,
  on: onMock,
  webContents: {
    send: webContentsSend,
  },
};

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    }),
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      listeners.set(channel, handler);
    }),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(() => mockWindow),
  },
}));

import { setupWindowEvents, setupWindowIpc } from "../window.ipc";

describe("setupWindowIpc", () => {
  beforeEach(() => {
    handlers.clear();
    listeners.clear();
    webContentsSend.mockClear();
    maximizeMock.mockClear();
    unmaximizeMock.mockClear();
    minimizeMock.mockClear();
    closeMock.mockClear();
    setBoundsMock.mockClear();
    onMock.mockClear();
    mockWindow.isDestroyed.mockReturnValue(false);
    mockWindow.isMaximized.mockReturnValue(false);
    setupWindowIpc(() => mockWindow);
  });

  it("toggles frameless windows using tracked state when Electron isMaximized is unreliable", () => {
    const handler = handlers.get("window:toggle-maximize")!;
    const event = { sender: mockWebContents };

    handler(event);
    expect(maximizeMock).toHaveBeenCalledTimes(1);
    expect(webContentsSend).toHaveBeenLastCalledWith("window:maximize-changed", true);

    handler(event);
    expect(unmaximizeMock).not.toHaveBeenCalled();
    expect(setBoundsMock).toHaveBeenCalledWith({ x: 10, y: 20, width: 690, height: 756 });
    expect(webContentsSend).toHaveBeenLastCalledWith("window:maximize-changed", false);
  });

  it("restores saved bounds when native unmaximize is a no-op", () => {
    const handler = handlers.get("window:toggle-maximize")!;
    const event = { sender: mockWebContents };

    handler(event);
    handler(event);

    expect(setBoundsMock).toHaveBeenCalledWith({ x: 10, y: 20, width: 690, height: 756 });
  });

  it("moves the current frameless window without changing its size", () => {
    const event = { sender: mockWebContents };

    listeners.get("window:drag-start")?.(event, 100, 200);
    listeners.get("window:drag-move")?.(event, 142, 263);

    expect(setBoundsMock).toHaveBeenLastCalledWith({
      x: 52,
      y: 83,
      width: 690,
      height: 756,
    }, false);

    listeners.get("window:drag-end")?.(event);
    setBoundsMock.mockClear();
    listeners.get("window:drag-move")?.(event, 170, 290);
    expect(setBoundsMock).not.toHaveBeenCalled();
  });

  it("returns the tracked maximize state to renderer callers", () => {
    const toggle = handlers.get("window:toggle-maximize")!;
    const read = handlers.get("window:is-maximized")!;
    const event = { sender: mockWebContents };

    expect(read(event)).toBe(false);
    toggle(event);
    expect(read(event)).toBe(true);
    toggle(event);
    expect(read(event)).toBe(false);
  });
});

describe("setupWindowEvents", () => {
  beforeEach(() => {
    listeners.clear();
    webContentsSend.mockClear();
    setBoundsMock.mockClear();
    onMock.mockClear();
  });

  it("clears an active manual drag when the window loses focus", () => {
    setupWindowIpc(() => mockWindow);
    const event = { sender: mockWebContents };
    listeners.get("window:drag-start")?.(event, 100, 200);

    setupWindowEvents(() => mockWindow);
    const blurListener = onMock.mock.calls.find((call) => call[0] === "blur")?.[1] as (() => void) | undefined;
    blurListener?.();
    listeners.get("window:drag-move")?.(event, 160, 260);

    expect(setBoundsMock).not.toHaveBeenCalled();
  });

  it("keeps tracked maximize state in sync with native window events", () => {
    setupWindowEvents(() => mockWindow);
    const maximizeListener = onMock.mock.calls.find((call) => call[0] === "maximize")?.[1] as (() => void) | undefined;
    const unmaximizeListener = onMock.mock.calls.find((call) => call[0] === "unmaximize")?.[1] as (() => void) | undefined;

    maximizeListener?.();
    expect(webContentsSend).toHaveBeenLastCalledWith("window:maximize-changed", true);

    unmaximizeListener?.();
    expect(webContentsSend).toHaveBeenLastCalledWith("window:maximize-changed", false);
  });
});

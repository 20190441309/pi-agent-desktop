import { beforeEach, describe, expect, it, vi } from "vitest";

const { openExternalMock } = vi.hoisted(() => ({
  openExternalMock: vi.fn(async () => undefined),
}));

vi.mock("electron", () => ({
  shell: { openExternal: openExternalMock },
}));

vi.mock("@electron-toolkit/utils", () => ({
  is: { dev: false },
}));

vi.mock("electron-log/main", () => ({
  default: { warn: vi.fn() },
}));

import {
  attachWebSecurityHandlers,
  isAllowedExternalUrl,
  isAllowedNavigationUrl,
} from "../web-security";

describe("web security URL policy", () => {
  beforeEach(() => {
    openExternalMock.mockClear();
  });

  it("only delegates HTTP and HTTPS URLs to the external browser", () => {
    expect(isAllowedExternalUrl("https://example.com/docs")).toBe(true);
    expect(isAllowedExternalUrl("http://example.com/docs")).toBe(true);
    expect(isAllowedExternalUrl("file:///C:/Windows/System32/calc.exe")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedExternalUrl("data:text/html,hello")).toBe(false);
    expect(isAllowedExternalUrl("custom-protocol://payload")).toBe(false);
  });

  it("allows only the current file document while ignoring query and hash", () => {
    const current = "file:///C:/app/renderer/index.html";
    expect(isAllowedNavigationUrl(`${current}?mode=chat#message-1`, current, false)).toBe(true);
    expect(isAllowedNavigationUrl("file:///C:/app/renderer/settings.html", current, false)).toBe(false);
    expect(isAllowedNavigationUrl("file:///C:/Users/demo/Downloads/attacker.html", current, false)).toBe(false);
  });

  it("allows same-origin web navigation and blocks unsafe or cross-origin schemes", () => {
    const current = "https://app.example.com/index.html";
    expect(isAllowedNavigationUrl("https://app.example.com/settings", current, false)).toBe(true);
    expect(isAllowedNavigationUrl("https://evil.example/settings", current, false)).toBe(false);
    expect(isAllowedNavigationUrl("javascript:alert(1)", current, false)).toBe(false);
    expect(isAllowedNavigationUrl("data:text/html,hello", current, false)).toBe(false);
    expect(isAllowedNavigationUrl("custom-protocol://payload", current, false)).toBe(false);
  });

  it("allows localhost HTTP navigation only when the development exception is enabled", () => {
    expect(isAllowedNavigationUrl("http://localhost:5173/settings.html", "about:blank", true)).toBe(true);
    expect(isAllowedNavigationUrl("https://127.0.0.1:5173/settings.html", "about:blank", true)).toBe(true);
    expect(isAllowedNavigationUrl("http://localhost:5173/settings.html", "about:blank", false)).toBe(false);
  });

  it("denies Electron child windows and never opens blocked schemes externally", async () => {
    let openHandler: ((details: { url: string }) => { action: string }) | undefined;
    const navigationListeners = new Map<string, (...args: unknown[]) => void>();
    const webContents = {
      getURL: vi.fn(() => "file:///C:/app/renderer/index.html"),
      setWindowOpenHandler: vi.fn((handler: typeof openHandler) => {
        openHandler = handler;
      }),
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        navigationListeners.set(event, listener);
      }),
    };

    attachWebSecurityHandlers({ webContents } as never);

    expect(openHandler?.({ url: "file:///C:/Users/demo/Downloads/attacker.html" })).toEqual({ action: "deny" });
    expect(openExternalMock).not.toHaveBeenCalled();

    expect(openHandler?.({ url: "https://example.com/docs" })).toEqual({ action: "deny" });
    await vi.waitFor(() => {
      expect(openExternalMock).toHaveBeenCalledWith("https://example.com/docs");
    });

    const preventDefault = vi.fn();
    navigationListeners.get("will-navigate")?.(
      { preventDefault },
      "file:///C:/Users/demo/Downloads/attacker.html",
    );
    expect(preventDefault).toHaveBeenCalledTimes(1);

    const redirectPreventDefault = vi.fn();
    navigationListeners.get("will-redirect")?.(
      { preventDefault: redirectPreventDefault },
      "https://evil.example/redirected",
    );
    expect(redirectPreventDefault).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { MiniMaxCodeTitleBar } from "./MiniMaxCodeTitleBar";

describe("MiniMaxCodeTitleBar", () => {
  beforeEach(() => {
    window.nodeAPI = { platform: "win32" } as never;
    window.piAPI = {
      windowIsMaximized: vi.fn().mockResolvedValue(false),
      onWindowMaximizeChanged: vi.fn(() => () => undefined),
      windowMinimize: vi.fn(),
      windowToggleMaximize: vi.fn(),
      windowClose: vi.fn(),
    } as never;
  });

  it("renders banner with title and window controls on Windows", async () => {
    render(
      <I18nProvider>
        <MiniMaxCodeTitleBar title="Pi Desktop" statusLabel="就绪" statusTone="ready" />
      </I18nProvider>,
    );
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByText("Pi Desktop")).toBeTruthy();
    expect(screen.getByText("就绪")).toBeTruthy();

    const minimize = await screen.findByRole("button", { name: /最小化|Minimize/i });
    fireEvent.click(minimize);
    expect(window.piAPI!.windowMinimize).toHaveBeenCalled();
  });

  it("uses onClose override for close button", async () => {
    const onClose = vi.fn();
    render(
      <I18nProvider>
        <MiniMaxCodeTitleBar title="Settings" onClose={onClose} />
      </I18nProvider>,
    );
    const close = await screen.findByRole("button", { name: /关闭|Close/i });
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.piAPI!.windowClose).not.toHaveBeenCalled();
  });
});

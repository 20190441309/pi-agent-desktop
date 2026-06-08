// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { usePiStatusStore } from "../../stores/pi-status-store";
import { PiStatusPanel } from "./PiStatusPanel";

describe("PiStatusPanel", () => {
  const uninstall = vi.fn();

  beforeEach(() => {
    uninstall.mockReset();
    usePiStatusStore.setState({
      status: {
        installed: true,
        localVersion: "0.75.5",
        latestVersion: "0.75.5",
        updateAvailable: false,
        executablePath: "C:/pi/pi.exe",
        installMethod: "npm",
        configExists: true,
        defaultProvider: "anthropic",
        defaultModel: "claude-sonnet",
      },
      loading: false,
      error: null,
      progress: null,
      isOperating: false,
      uninstall,
      checkStatus: vi.fn(async () => undefined),
      refreshStatus: vi.fn(async () => undefined),
      setupListeners: vi.fn(),
      cleanupListeners: vi.fn(),
    });
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  it("confirms Pi CLI uninstall inside the app instead of window.confirm", () => {
    render(
      <I18nProvider>
        <PiStatusPanel />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "卸载" }));

    expect(screen.getByRole("dialog", { name: "确认卸载 Pi CLI" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "卸载" })[1]);

    expect(uninstall).toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
  });
});

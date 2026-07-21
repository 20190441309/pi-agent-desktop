// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../i18n";
import { AppearanceTab } from "./AppearanceTab";

const { useSettingsStore, setTheme, updateSettings } = vi.hoisted(() => {
  const setTheme = vi.fn();
  const updateSettings = vi.fn();
  const useSettingsStore = Object.assign(
    vi.fn(() => ({
      settings: { theme: "light", fontSize: 14 },
      updateSettings,
    })),
    { getState: () => ({ setTheme }) },
  );
  return { useSettingsStore, setTheme, updateSettings };
});

vi.mock("../../../stores/settings-store", () => ({ useSettingsStore }));

describe("AppearanceTab", () => {
  beforeEach(() => {
    setTheme.mockReset();
    updateSettings.mockReset();
  });

  it("switches theme via theme cards", () => {
    render(
      <I18nProvider>
        <AppearanceTab />
      </I18nProvider>,
    );
    // three theme buttons
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(buttons[1]!);
    expect(setTheme).toHaveBeenCalled();
  });

  it("updates font size from range input", () => {
    render(
      <I18nProvider>
        <AppearanceTab />
      </I18nProvider>,
    );
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "18" } });
    expect(updateSettings).toHaveBeenCalledWith({ fontSize: 18 });
  });
});

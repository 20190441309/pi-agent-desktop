// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelSelector } from "./ModelSelector";

const { useSettingsStore } = vi.hoisted(() => ({
  useSettingsStore: vi.fn(),
}));

vi.mock("../../stores/settings-store", () => ({ useSettingsStore }));

describe("Settings ModelSelector", () => {
  const updateSettings = vi.fn();

  beforeEach(() => {
    updateSettings.mockReset();
    useSettingsStore.mockReturnValue({
      settings: { model: "m1", provider: "p1", temperature: 0.7, maxTokens: 4096 },
      updateSettings,
      piModels: [
        {
          id: "m1",
          name: "Model One",
          description: "first",
          provider: "p1",
          providerName: "Provider One",
        },
        {
          id: "m2",
          name: "Model Two",
          description: "second",
          provider: "p2",
          providerName: "Provider Two",
        },
      ],
    });
  });

  it("selects a model via accessible button", () => {
    render(<ModelSelector />);
    const m2 = screen.getByRole("button", { name: "选择模型 Model Two" });
    expect(m2.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(m2);
    expect(updateSettings).toHaveBeenCalledWith({ model: "m2", provider: "p2" });
    expect(screen.getByRole("button", { name: "选择模型 Model One" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("shows empty Pi config message when no models", () => {
    useSettingsStore.mockReturnValue({
      settings: { model: "", provider: "", temperature: 1, maxTokens: 1024 },
      updateSettings,
      piModels: [],
    });
    render(<ModelSelector />);
    expect(screen.getByText(/未检测到 Pi 配置/)).toBeTruthy();
  });
});

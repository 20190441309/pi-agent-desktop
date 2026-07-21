// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { TopTabBar } from "./TopTabBar";

describe("TopTabBar", () => {
  it("renders four section tabs and notifies onTabChange", () => {
    const onTabChange = vi.fn();
    render(
      <I18nProvider>
        <TopTabBar activeTab="chat" onTabChange={onTabChange} />
      </I18nProvider>,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(4);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(tabs[2]!);
    expect(onTabChange).toHaveBeenCalledWith("workbench");
  });

  it("renders settings button when onOpenSettings provided", () => {
    const onOpenSettings = vi.fn();
    render(
      <I18nProvider>
        <TopTabBar activeTab="run" onTabChange={vi.fn()} onOpenSettings={onOpenSettings} />
      </I18nProvider>,
    );
    const settings = screen.getByRole("button", { name: /设置|Settings|openSettings/i });
    fireEvent.click(settings);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});

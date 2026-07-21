// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { RunPanel } from "./RunPanel";

vi.mock("../LongHorizon/MemoryPanel", () => ({
  MemoryPanel: () => <div>MemoryPanelMock</div>,
}));

vi.mock("../LongHorizon/TaskOverviewPanel", () => ({
  TaskOverviewPanel: () => <div>TaskOverviewMock</div>,
}));

describe("RunPanel", () => {
  it("renders tasks tab content when view=tasks and switches on click", () => {
    const onViewChange = vi.fn();
    const { rerender } = render(
      <I18nProvider>
        <RunPanel view="tasks" onViewChange={onViewChange} />
      </I18nProvider>,
    );
    expect(screen.getByText("TaskOverviewMock")).toBeTruthy();
    expect(screen.queryByText("MemoryPanelMock")).toBeNull();

    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(2);
    fireEvent.click(tabs[1]!);
    expect(onViewChange).toHaveBeenCalledWith("memory");

    rerender(
      <I18nProvider>
        <RunPanel view="memory" onViewChange={onViewChange} />
      </I18nProvider>,
    );
    expect(screen.getByText("MemoryPanelMock")).toBeTruthy();
  });
});

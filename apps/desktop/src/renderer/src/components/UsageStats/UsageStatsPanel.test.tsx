// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { I18nProvider } from "../../i18n";
import { UsageStatsPanel } from "./UsageStatsPanel";

const { useSessionStore, useWorkspaceStore } = vi.hoisted(() => ({
  useSessionStore: vi.fn(),
  useWorkspaceStore: vi.fn(),
}));

vi.mock("../../stores/session-store", () => ({ useSessionStore }));
vi.mock("../../stores/workspace-store", () => ({ useWorkspaceStore }));

describe("UsageStatsPanel", () => {
  beforeEach(() => {
    useSessionStore.mockReturnValue({
      sessions: [
        {
          id: "s1",
          workspaceId: "w1",
          title: "demo",
          archived: false,
          favorite: false,
          createdAt: new Date("2026-07-20T00:00:00Z"),
          updatedAt: new Date("2026-07-20T00:00:00Z"),
          lastOpenedAt: new Date("2026-07-20T00:00:00Z"),
          messages: [],
          usage: {
            provider: "minimax",
            model: "MiniMax-M3",
            inputTokens: 1000,
            outputTokens: 500,
            estimatedCostUsd: 0.01,
            updatedAt: new Date("2026-07-20T10:00:00Z").getTime(),
          },
        },
      ],
    });
    useWorkspaceStore.mockReturnValue({
      getCurrentWorkspace: () => ({ id: "w1", name: "ws", path: "C:/ws" }),
    });
  });

  it("renders usage overview for current workspace sessions", () => {
    render(
      <I18nProvider>
        <UsageStatsPanel />
      </I18nProvider>,
    );
    const panel = screen.getByTestId("usage-stats-panel");
    expect(panel).toBeTruthy();
    expect(panel.textContent).toContain("1.5K");
    expect(panel.textContent).toContain("MiniMax-M3");
    expect(panel.textContent).toMatch(/1 个会话|1 session/i);
  });
});

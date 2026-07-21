// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../i18n";
import { PermissionsTab } from "./PermissionsTab";

vi.mock("../../../stores/workspace-store", () => ({
  useWorkspaceStore: (selector: (s: { getCurrentWorkspace: () => unknown }) => unknown) =>
    selector({
      getCurrentWorkspace: () => ({ id: "w1", name: "Demo", path: "C:/demo" }),
    }),
}));

vi.mock("../../ToolPermissions/ToolPermissionsPanel", () => ({
  ToolPermissionsPanel: ({ workspaceId }: { workspaceId?: string }) => (
    <div data-testid="tool-permissions">{workspaceId}</div>
  ),
}));

describe("PermissionsTab", () => {
  it("shows current workspace path and tools panel", () => {
    render(
      <I18nProvider>
        <PermissionsTab />
      </I18nProvider>,
    );
    expect(screen.getByText(/Demo · C:\/demo/)).toBeTruthy();
    expect(screen.getByTestId("tool-permissions").textContent).toBe("w1");
  });
});

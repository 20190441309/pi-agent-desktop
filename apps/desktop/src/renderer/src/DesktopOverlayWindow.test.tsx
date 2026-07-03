// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopOverlayWindow } from "./DesktopOverlayWindow";
import { usePermissionStore } from "./stores/permission-store";

describe("DesktopOverlayWindow", () => {
  beforeEach(() => {
    usePermissionStore.setState({
      mode: "smart",
      pending: [],
    });
    Object.defineProperty(window, "piAPI", {
      value: {
        agentsList: vi.fn(async () => []),
        onAgentsState: vi.fn(() => () => undefined),
        onPlanProgress: vi.fn(() => () => undefined),
        send: vi.fn(),
      },
      configurable: true,
    });
  });

  it("does not render permission cards inside the desktop overlay window", () => {
    usePermissionStore.setState({
      mode: "smart",
      pending: [
        {
          requestId: "overlay_permission",
          workspaceId: "ws1",
          kind: "select",
          source: "permission",
          title: "Overlay permission should stay in main window",
          createdAt: Date.now(),
        },
      ],
    });

    render(<DesktopOverlayWindow />);

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

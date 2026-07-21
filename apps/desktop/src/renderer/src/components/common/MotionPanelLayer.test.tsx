// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MotionPanelLayer } from "./MotionPanelLayer";

describe("MotionPanelLayer", () => {
  it("exposes active state via data attributes and a11y", () => {
    render(
      <MotionPanelLayer active panelId="chat" enterOnMount>
        <div>content</div>
      </MotionPanelLayer>,
    );
    const panel = screen.getByTestId("motion-panel-chat");
    expect(panel.getAttribute("data-active")).toBe("true");
    expect(panel.getAttribute("data-main-panel")).toBe("chat");
    expect(panel.getAttribute("data-enter-on-mount")).toBe("true");
    expect(panel.getAttribute("aria-hidden")).toBe("false");
    expect(panel.hasAttribute("inert")).toBe(false);
    expect(screen.getByText("content")).toBeTruthy();
  });

  it("hides inactive panels with aria-hidden and inert", () => {
    render(
      <MotionPanelLayer active={false} panelId="run">
        <div>hidden</div>
      </MotionPanelLayer>,
    );
    const panel = screen.getByTestId("motion-panel-run");
    expect(panel.getAttribute("data-active")).toBe("false");
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(panel.hasAttribute("inert")).toBe(true);
    expect(panel.getAttribute("data-enter-on-mount")).toBe("false");
  });
});

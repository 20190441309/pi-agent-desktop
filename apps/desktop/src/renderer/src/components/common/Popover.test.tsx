// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Popover } from "./Popover";

vi.mock("../../hooks/useMotionPresence", () => ({
  useMotionPresence: (open: boolean) => ({
    rendered: open,
    state: open ? "enter" : "exit",
  }),
}));

describe("Popover", () => {
  it("opens on trigger click and closes on second click", () => {
    render(
      <Popover trigger={<button type="button">Open menu</button>}>
        <div>Menu body</div>
      </Popover>,
    );
    expect(screen.queryByText("Menu body")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByText("Menu body")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.queryByText("Menu body")).toBeNull();
  });

  it("supports render-prop children close callback", () => {
    render(
      <Popover trigger={<button type="button">Open menu</button>}>
        {(close) => (
          <button type="button" onClick={close}>
            Close from content
          </button>
        )}
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Close from content" }));
    expect(screen.queryByRole("button", { name: "Close from content" })).toBeNull();
  });

  it("closes on Escape", () => {
    render(
      <Popover trigger={<button type="button">Open menu</button>}>
        <div>Menu body</div>
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByText("Menu body")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Menu body")).toBeNull();
  });
});

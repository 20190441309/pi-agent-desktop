// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useFocusTrap } from "./useFocusTrap";

function TrapDialog({ active = true }: { active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active);
  return (
    <div>
      <button type="button">Outside</button>
      <div ref={ref} data-testid="dialog" role="dialog">
        <button type="button">First</button>
        <button type="button">Last</button>
      </div>
    </div>
  );
}

describe("useFocusTrap", () => {
  afterEach(() => {
    cleanup();
  });

  it("moves focus into the dialog on activate", () => {
    render(<TrapDialog active />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));
  });

  it("cycles Tab from last to first and Shift+Tab from first to last", () => {
    render(<TrapDialog active />);
    const dialog = screen.getByTestId("dialog");
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("is a no-op when inactive", () => {
    render(<TrapDialog active={false} />);
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "First" }));
  });
});

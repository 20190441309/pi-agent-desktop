// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimatedCollapse } from "./AnimatedCollapse";

describe("AnimatedCollapse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders children when expanded", () => {
    render(
      <AnimatedCollapse expanded>
        <span>panel body</span>
      </AnimatedCollapse>,
    );
    expect(screen.getByText("panel body")).toBeTruthy();
    const root = screen.getByText("panel body").parentElement?.parentElement;
    expect(root?.getAttribute("aria-hidden")).toBe("false");
  });

  it("keeps content briefly then unmounts when collapsed", () => {
    const { rerender, container } = render(
      <AnimatedCollapse expanded>
        <span>panel body</span>
      </AnimatedCollapse>,
    );
    rerender(
      <AnimatedCollapse expanded={false}>
        <span>panel body</span>
      </AnimatedCollapse>,
    );
    expect(screen.getByText("panel body")).toBeTruthy();
    const root = screen.getByText("panel body").parentElement?.parentElement;
    expect(root?.getAttribute("aria-hidden")).toBe("true");

    act(() => {
      vi.advanceTimersByTime(160);
    });
    expect(container.textContent).toBe("");
  });

  it("returns null when starting collapsed", () => {
    const { container } = render(
      <AnimatedCollapse expanded={false}>
        <span>hidden</span>
      </AnimatedCollapse>,
    );
    expect(container.textContent).toBe("");
  });
});

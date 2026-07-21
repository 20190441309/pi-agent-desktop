// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMotionPresence, useMotionPresenceList } from "./useMotionPresence";

describe("useMotionPresence", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders enter state while open", () => {
    const { result } = renderHook(() => useMotionPresence(true, 100));
    expect(result.current).toEqual({ rendered: true, state: "enter" });
  });

  it("keeps rendered during exit then drops after timeout", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ open }) => useMotionPresence(open, 50),
      { initialProps: { open: true } },
    );
    rerender({ open: false });
    expect(result.current).toEqual({ rendered: true, state: "exit" });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toEqual({ rendered: false, state: "exit" });
  });
});

describe("useMotionPresenceList", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("marks removed items as exit then purges them after exitMs", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ items }) => useMotionPresenceList(items, (item) => item, 40),
      { initialProps: { items: ["a", "b"] } },
    );
    expect(result.current.map((e) => [e.item, e.state])).toEqual([
      ["a", "enter"],
      ["b", "enter"],
    ]);

    rerender({ items: ["a"] });
    expect(result.current.map((e) => [e.item, e.state])).toEqual([
      ["a", "enter"],
      ["b", "exit"],
    ]);

    act(() => {
      vi.advanceTimersByTime(40);
    });
    expect(result.current.map((e) => [e.item, e.state])).toEqual([["a", "enter"]]);
  });
});

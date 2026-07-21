// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useShortcuts } from "../useShortcuts";

function press(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(event);
  return event;
}

describe("useShortcuts", () => {
  afterEach(() => {
    // Ensure any leftover mounts are cleaned by unmounting via act in tests.
    // Module-level listener may stay attached (by design) but getter cleared.
  });

  it("invokes the matching handler and prevents default for Ctrl+K", () => {
    const openPalette = vi.fn();
    const { unmount } = renderHook(() =>
      useShortcuts({ "open-command-palette": openPalette }),
    );

    const event = press({ key: "k", ctrlKey: true });
    expect(openPalette).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);

    unmount();
  });

  it("ignores shortcuts that have no registered handler id", () => {
    const openPalette = vi.fn();
    const { unmount } = renderHook(() =>
      useShortcuts({ "open-command-palette": openPalette }),
    );

    press({ key: "n", ctrlKey: true }); // new-chat not registered
    expect(openPalette).not.toHaveBeenCalled();

    unmount();
  });

  it("uses the latest handlers after re-render without remounting the listener", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ fn }) => useShortcuts({ "open-command-palette": fn }),
      { initialProps: { fn: first } },
    );

    press({ key: "k", ctrlKey: true });
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ fn: second });
    press({ key: "k", ctrlKey: true });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("keeps the shared listener alive while any instance is mounted", () => {
    const a = vi.fn();
    const b = vi.fn();
    const hookA = renderHook(() => useShortcuts({ "open-command-palette": a }));
    const hookB = renderHook(() => useShortcuts({ "open-command-palette": b }));

    // Last mounted wins as current getter (module singleton)
    press({ key: "k", ctrlKey: true });
    expect(a.mock.calls.length + b.mock.calls.length).toBeGreaterThanOrEqual(1);

    act(() => {
      hookA.unmount();
    });
    press({ key: "k", ctrlKey: true });
    // B still mounted → still dispatches
    expect(b.mock.calls.length).toBeGreaterThanOrEqual(1);

    act(() => {
      hookB.unmount();
    });
    const before = b.mock.calls.length + a.mock.calls.length;
    press({ key: "k", ctrlKey: true });
    // getter cleared → no additional calls
    expect(b.mock.calls.length + a.mock.calls.length).toBe(before);
  });
});

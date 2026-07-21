// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTransientState } from "./useTransientState";

describe("useTransientState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds a value then clears after duration", () => {
    const { result } = renderHook(() => useTransientState<string>(1000));
    expect(result.current[0]).toBeNull();
    act(() => {
      result.current[1]("toast");
    });
    expect(result.current[0]).toBe("toast");
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current[0]).toBe("toast");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current[0]).toBeNull();
  });

  it("resets the timer on successive writes", () => {
    const { result } = renderHook(() => useTransientState<string>(500));
    act(() => {
      result.current[1]("a");
    });
    act(() => {
      vi.advanceTimersByTime(400);
      result.current[1]("b");
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current[0]).toBe("b");
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current[0]).toBeNull();
  });

  it("setTransient(null) clears immediately without waiting", () => {
    const { result } = renderHook(() => useTransientState<number>(2000));
    act(() => {
      result.current[1](1);
      result.current[1](null);
    });
    expect(result.current[0]).toBeNull();
  });
});

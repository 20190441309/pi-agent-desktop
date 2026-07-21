// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLatestRequest } from "./useLatestRequest";

describe("useLatestRequest", () => {
  it("marks the highest begin() id as latest", () => {
    const { result } = renderHook(() => useLatestRequest());
    let a = 0;
    let b = 0;
    act(() => {
      a = result.current.begin();
      b = result.current.begin();
    });
    expect(a).toBeLessThan(b);
    expect(result.current.isLatest(a)).toBe(false);
    expect(result.current.isLatest(b)).toBe(true);
  });

  it("cancel invalidates all in-flight request ids", () => {
    const { result } = renderHook(() => useLatestRequest());
    let id = 0;
    act(() => {
      id = result.current.begin();
      result.current.cancel();
    });
    expect(result.current.isLatest(id)).toBe(false);
    let next = 0;
    act(() => {
      next = result.current.begin();
    });
    expect(result.current.isLatest(next)).toBe(true);
  });

  it("returns a referentially stable API object", () => {
    const { result, rerender } = renderHook(() => useLatestRequest());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

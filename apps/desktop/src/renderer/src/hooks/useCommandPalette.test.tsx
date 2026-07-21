// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useCommandPalette } from "./useCommandPalette";

describe("useCommandPalette", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts closed", () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.isOpen).toBe(false);
  });

  it("setIsOpen and close toggle open state", () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      result.current.setIsOpen(true);
    });
    expect(result.current.isOpen).toBe(true);
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });
});

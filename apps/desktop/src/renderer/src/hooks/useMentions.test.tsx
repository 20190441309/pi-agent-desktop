// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMentions } from "./useMentions";

describe("useMentions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(window, "piAPI", {
      configurable: true,
      value: {
        filesList: vi.fn(async () => [
          { path: "src/app.ts", name: "app.ts", size: 1, isDirectory: false },
          { path: "src/utils/fuzzy-match.ts", name: "fuzzy-match.ts", size: 1, isDirectory: false },
          { path: "README.md", name: "README.md", size: 1, isDirectory: false },
        ]),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("stays inactive without @mention or workspace", async () => {
    const { result, rerender } = renderHook(
      ({ text, cursor, ws }) => useMentions(text, cursor, ws),
      { initialProps: { text: "hello", cursor: 5, ws: "C:/ws" as string | undefined } },
    );
    expect(result.current.activeMention).toBeNull();
    expect(result.current.candidates).toEqual([]);

    rerender({ text: "see @ap", cursor: 7, ws: undefined });
    expect(result.current.activeMention).toBeNull();
  });

  it("activates on @query and loads ranked candidates", async () => {
    const { result } = renderHook(() => useMentions("open @app", 9, "C:/ws"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    await waitFor(() => {
      expect(result.current.activeMention?.query).toBe("app");
      expect(result.current.candidates.length).toBeGreaterThan(0);
      expect(result.current.candidates[0]?.path).toContain("app");
    });
    expect(window.piAPI.filesList).toHaveBeenCalled();
  });

  it("selectCandidate replaces mention with path + trailing space", async () => {
    const { result } = renderHook(() => useMentions("open @app", 9, "C:/ws"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    await waitFor(() => {
      expect(result.current.activeMention).not.toBeNull();
    });
    const replaced = result.current.selectCandidate({ path: "src/app.ts", score: 100 });
    expect(replaced).toBe("open @src/app.ts ");
  });

  it("close clears active mention and candidates", async () => {
    const { result } = renderHook(() => useMentions("@re", 3, "C:/ws"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    await waitFor(() => {
      expect(result.current.activeMention).not.toBeNull();
    });
    act(() => {
      result.current.close();
    });
    expect(result.current.activeMention).toBeNull();
    expect(result.current.candidates).toEqual([]);
    expect(result.current.highlightIndex).toBe(0);
  });

  it("clears candidates when filesList fails", async () => {
    Object.defineProperty(window, "piAPI", {
      configurable: true,
      value: {
        filesList: vi.fn(async () => {
          throw new Error("ipc down");
        }),
      },
    });
    const { result } = renderHook(() => useMentions("@x", 2, "C:/ws"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    await waitFor(() => {
      expect(result.current.activeMention?.query).toBe("x");
    });
    expect(result.current.candidates).toEqual([]);
  });
});

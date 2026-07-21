// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createRef, useState } from "react";
import { usePrefillConsumer } from "./usePrefillConsumer";

/**
 * StrictMode double-invokes effects in this test env, so onConsumed call counts
 * assert "at least once" / "increased" rather than exact ones.
 */
describe("usePrefillConsumer", () => {
  it("applies prefill into an empty composer and focuses caret at end", async () => {
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    const focus = vi.spyOn(ta, "focus");
    const setSelectionRange = vi.spyOn(ta, "setSelectionRange");
    const onConsumed = vi.fn();

    const { result, rerender } = renderHook(
      ({ prefill, key }) => {
        const [inputValue, setInputValue] = useState("");
        const textareaRef = createRef<HTMLTextAreaElement | null>();
        (textareaRef as { current: HTMLTextAreaElement | null }).current = ta;
        usePrefillConsumer(prefill, key, onConsumed, textareaRef, setInputValue);
        return inputValue;
      },
      { initialProps: { prefill: undefined as string | undefined, key: 0 } },
    );

    await act(async () => {
      rerender({ prefill: "hello world ", key: 1 });
    });
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    });

    expect(result.current).toBe("hello world ");
    expect(onConsumed.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(focus).toHaveBeenCalled();
    expect(setSelectionRange).toHaveBeenCalled();

    document.body.removeChild(ta);
  });

  it("appends prefill without clobbering existing typed text", async () => {
    const onConsumed = vi.fn();
    const { result, rerender } = renderHook(
      ({ prefill, key }) => {
        const [inputValue, setInputValue] = useState("already ");
        const textareaRef = createRef<HTMLTextAreaElement | null>();
        usePrefillConsumer(prefill, key, onConsumed, textareaRef, setInputValue);
        return inputValue;
      },
      { initialProps: { prefill: undefined as string | undefined, key: 0 } },
    );

    expect(result.current).toBe("already ");
    await act(async () => {
      rerender({ prefill: "extra", key: 2 });
    });
    expect(result.current).toBe("already extra");
    expect(onConsumed.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not duplicate when existing text already contains the prefill", async () => {
    const onConsumed = vi.fn();
    const { result, rerender } = renderHook(
      ({ prefill, key }) => {
        const [inputValue, setInputValue] = useState("see @src/a.ts here");
        const textareaRef = createRef<HTMLTextAreaElement | null>();
        usePrefillConsumer(prefill, key, onConsumed, textareaRef, setInputValue);
        return inputValue;
      },
      { initialProps: { prefill: undefined as string | undefined, key: 0 } },
    );

    await act(async () => {
      rerender({ prefill: "@src/a.ts", key: 3 });
    });
    expect(result.current).toBe("see @src/a.ts here");
    expect(onConsumed.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("re-applies when prefillKey changes even if the string is identical", async () => {
    const onConsumed = vi.fn();
    const { rerender } = renderHook(
      ({ prefill, key }) => {
        const [inputValue, setInputValue] = useState("");
        const textareaRef = createRef<HTMLTextAreaElement | null>();
        usePrefillConsumer(prefill, key, onConsumed, textareaRef, setInputValue);
        return inputValue;
      },
      { initialProps: { prefill: "same", key: 1 } },
    );
    const first = onConsumed.mock.calls.length;
    expect(first).toBeGreaterThanOrEqual(1);
    await act(async () => {
      rerender({ prefill: "same", key: 2 });
    });
    expect(onConsumed.mock.calls.length).toBeGreaterThan(first);
  });

  it("ignores empty prefill", async () => {
    const onConsumed = vi.fn();
    const { result, rerender } = renderHook(
      ({ prefill, key }) => {
        const [inputValue, setInputValue] = useState("keep");
        const textareaRef = createRef<HTMLTextAreaElement | null>();
        usePrefillConsumer(prefill, key, onConsumed, textareaRef, setInputValue);
        return inputValue;
      },
      { initialProps: { prefill: undefined as string | undefined, key: 0 } },
    );
    await act(async () => {
      rerender({ prefill: "", key: 1 });
    });
    expect(result.current).toBe("keep");
    expect(onConsumed).not.toHaveBeenCalled();
  });
});

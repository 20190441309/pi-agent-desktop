import { beforeEach, describe, expect, it } from "vitest";
import { addToast, useToastStore } from "../toast-store";

describe("toast-store", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it("addToast helper defaults tone to error with 6000ms duration", () => {
    const id = addToast("boom");
    const toast = useToastStore.getState().toasts.find((t) => t.id === id);
    expect(toast).toMatchObject({
      message: "boom",
      tone: "error",
      duration: 6000,
    });
    expect(id).toMatch(/^toast_/);
  });

  it("non-error tones default to 3000ms duration", () => {
    const id = addToast("ok", "success");
    const toast = useToastStore.getState().toasts.find((t) => t.id === id);
    expect(toast?.duration).toBe(3000);
    expect(toast?.tone).toBe("success");
  });

  it("respects explicit duration override", () => {
    const id = useToastStore.getState().addToast({
      message: "custom",
      tone: "info",
      duration: 1200,
    });
    expect(useToastStore.getState().toasts.find((t) => t.id === id)?.duration).toBe(1200);
  });

  it("keeps at most 5 toasts (drops oldest)", () => {
    for (let i = 0; i < 7; i += 1) {
      addToast(`m${i}`, "info");
    }
    const messages = useToastStore.getState().toasts.map((t) => t.message);
    expect(messages).toHaveLength(5);
    expect(messages[0]).toBe("m2");
    expect(messages[4]).toBe("m6");
  });

  it("removeToast and clearAll mutate list", () => {
    const a = addToast("a", "info");
    const b = addToast("b", "info");
    useToastStore.getState().removeToast(a);
    expect(useToastStore.getState().toasts.map((t) => t.id)).toEqual([b]);
    useToastStore.getState().clearAll();
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("stores optional retryAction", () => {
    const retry = () => undefined;
    const id = addToast("retry me", "warning", retry);
    expect(useToastStore.getState().toasts.find((t) => t.id === id)?.retryAction).toBe(retry);
  });
});

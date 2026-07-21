import { describe, expect, it, vi } from "vitest";
import { createSubscriptionManager } from "./subscription-manager";

describe("createSubscriptionManager", () => {
  it("runs setup once and tracks subscription", () => {
    const manager = createSubscriptionManager();
    const setup = vi.fn(() => () => undefined);
    expect(manager.isSubscribed).toBe(false);
    manager.ensure(setup);
    manager.ensure(setup);
    expect(setup).toHaveBeenCalledTimes(1);
    expect(manager.isSubscribed).toBe(true);
  });

  it("accepts a single unsubscribe function from setup", () => {
    const manager = createSubscriptionManager();
    const unsub = vi.fn();
    manager.ensure(() => unsub);
    manager.cleanup();
    expect(unsub).toHaveBeenCalledTimes(1);
    expect(manager.isSubscribed).toBe(false);
  });

  it("accepts an array of unsubscribers and runs them on cleanup", () => {
    const manager = createSubscriptionManager();
    const a = vi.fn();
    const b = vi.fn();
    manager.ensure(() => [a, b]);
    manager.cleanup();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("allows re-subscribe after cleanup", () => {
    const manager = createSubscriptionManager();
    const first = vi.fn(() => () => undefined);
    const second = vi.fn(() => () => undefined);
    manager.ensure(first);
    manager.cleanup();
    manager.ensure(second);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(manager.isSubscribed).toBe(true);
  });

  it("handles setup with no return value", () => {
    const manager = createSubscriptionManager();
    manager.ensure(() => undefined);
    expect(manager.isSubscribed).toBe(true);
    manager.cleanup();
    expect(manager.isSubscribed).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { createKeyedMutator, createMutationQueue } from "../mutation-queue";

describe("createMutationQueue", () => {
  it("runs tasks serially in submission order", async () => {
    const queue = createMutationQueue();
    const order: number[] = [];
    const slow = queue.run(async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push(1);
      return 1;
    });
    const fast = queue.run(async () => {
      order.push(2);
      return 2;
    });
    await expect(Promise.all([slow, fast])).resolves.toEqual([1, 2]);
    expect(order).toEqual([1, 2]);
  });

  it("propagates errors without blocking later runs", async () => {
    const queue = createMutationQueue();
    const failed = queue.run(() => {
      throw new Error("boom");
    });
    await expect(failed).rejects.toThrow("boom");
    await expect(queue.run(() => "ok")).resolves.toBe("ok");
  });
});

describe("createKeyedMutator", () => {
  it("read-modify-writes a key under the shared queue", async () => {
    const store = new Map<string, number>([["n", 0]]);
    const queue = createMutationQueue();
    const mutate = createKeyedMutator(queue, store, "n");
    const a = mutate((n) => n + 1);
    const b = mutate((n) => n + 2);
    await expect(Promise.all([a, b])).resolves.toEqual([1, 3]);
    expect(store.get("n")).toBe(3);
  });
});

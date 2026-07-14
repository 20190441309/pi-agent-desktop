import { describe, expect, it, vi } from "vitest";
import { registerSingleInstance } from "../single-instance";

type SecondInstanceListener = () => void;

function createFakeApp(lockAcquired: boolean) {
  let secondInstanceListener: SecondInstanceListener | null = null;
  return {
    requestSingleInstanceLock: vi.fn(() => lockAcquired),
    on: vi.fn((event: "second-instance", listener: SecondInstanceListener) => {
      if (event === "second-instance") secondInstanceListener = listener;
    }),
    quit: vi.fn(),
    exit: vi.fn(),
    emitSecondInstance() {
      secondInstanceListener?.();
    },
  };
}

describe("registerSingleInstance", () => {
  it("keeps the first instance and restores it when another launch is attempted", () => {
    const app = createFakeApp(true);
    const restoreExistingWindow = vi.fn();

    const isPrimaryInstance = registerSingleInstance(app, restoreExistingWindow);
    app.emitSecondInstance();

    expect(isPrimaryInstance).toBe(true);
    expect(app.quit).not.toHaveBeenCalled();
    expect(restoreExistingWindow).toHaveBeenCalledOnce();
  });

  it("quits a later instance immediately when the lock is already held", () => {
    const app = createFakeApp(false);
    const restoreExistingWindow = vi.fn();

    const isPrimaryInstance = registerSingleInstance(app, restoreExistingWindow);
    app.emitSecondInstance();

    expect(isPrimaryInstance).toBe(false);
    expect(app.exit).toHaveBeenCalledOnce();
    expect(app.exit).toHaveBeenCalledWith(0);
    expect(app.quit).not.toHaveBeenCalled();
    expect(restoreExistingWindow).not.toHaveBeenCalled();
  });
});

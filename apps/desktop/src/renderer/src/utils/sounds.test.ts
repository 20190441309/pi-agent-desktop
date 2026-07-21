// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSoundVolume,
  isSoundEnabled,
  playCompleteSound,
  playErrorSound,
  playMessageSound,
  setSoundEnabled,
  setSoundVolume,
} from "./sounds";

function createLocalStorageMock(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("sounds settings", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createLocalStorageMock(),
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("defaults to enabled with volume 0.5", () => {
    expect(isSoundEnabled()).toBe(true);
    expect(getSoundVolume()).toBe(0.5);
  });

  it("persists enable/disable", () => {
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });

  it("clamps volume to [0, 1]", () => {
    setSoundVolume(1.5);
    expect(getSoundVolume()).toBe(1);
    setSoundVolume(-0.2);
    expect(getSoundVolume()).toBe(0);
    setSoundVolume(0.33);
    expect(getSoundVolume()).toBe(0.33);
  });

  it("does not open AudioContext when sound is disabled", () => {
    const AudioContextMock = vi.fn();
    vi.stubGlobal("AudioContext", AudioContextMock);
    setSoundEnabled(false);
    playMessageSound();
    playErrorSound();
    playCompleteSound();
    expect(AudioContextMock).not.toHaveBeenCalled();
  });

  it("plays tones through AudioContext when enabled", () => {
    const close = vi.fn(async () => undefined);
    const stop = vi.fn();
    const start = vi.fn();
    const connect = vi.fn();
    const exponentialRampToValueAtTime = vi.fn();
    const oscillator = {
      type: "sine",
      frequency: { value: 0 },
      connect,
      start,
      stop,
    };
    const gainNode = {
      gain: { value: 0, exponentialRampToValueAtTime },
      connect,
    };
    const createOscillator = vi.fn(() => oscillator);
    const createGain = vi.fn(() => gainNode);
    const AudioContextMock = vi.fn(function AudioContext(this: {
      createOscillator: typeof createOscillator;
      createGain: typeof createGain;
      destination: object;
      currentTime: number;
      close: typeof close;
    }) {
      this.createOscillator = createOscillator;
      this.createGain = createGain;
      this.destination = {};
      this.currentTime = 0;
      this.close = close;
    });
    vi.stubGlobal("AudioContext", AudioContextMock);

    setSoundEnabled(true);
    setSoundVolume(0.8);
    playMessageSound();
    expect(AudioContextMock).toHaveBeenCalled();
    expect(start).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
    expect(exponentialRampToValueAtTime).toHaveBeenCalled();

    vi.runAllTimers();
    expect(close).toHaveBeenCalled();
  });
});

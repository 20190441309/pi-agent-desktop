import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampAgentModeByRuntime,
  isRuntimeFeatureEnabled,
  supportedAgentModes,
  useRuntimeFeatureStore,
} from "../runtime-feature-store";
import type { MiMoCodeRuntimeFeatureState } from "@shared";

function featureToggle(supported: boolean, enabled: boolean) {
  return { supported, enabled };
}

function makeFeatureState(
  overrides: Partial<MiMoCodeRuntimeFeatureState["features"]> = {},
): MiMoCodeRuntimeFeatureState {
  const base = {
    planMode: featureToggle(true, true),
    composeMode: featureToggle(true, true),
    memory: featureToggle(true, true),
    history: featureToggle(true, true),
    checkpoint: featureToggle(true, false),
    goal: featureToggle(false, true),
    task: featureToggle(true, true),
    actor: featureToggle(true, true),
    subagents: featureToggle(true, true),
  };
  return {
    features: { ...base, ...overrides },
  } as MiMoCodeRuntimeFeatureState;
}

describe("supportedAgentModes", () => {
  it("falls back to longHorizon settings when featureState is null", () => {
    expect(supportedAgentModes(null, { enabled: false })).toEqual(["build"]);
    expect(
      supportedAgentModes(null, {
        enabled: true,
        planMode: { enabled: true },
        composeMode: { enabled: false },
      }),
    ).toEqual(["build", "plan"]);
    expect(
      supportedAgentModes(null, {
        enabled: true,
        planMode: { enabled: true },
        composeMode: { enabled: true },
      }),
    ).toEqual(["build", "plan", "compose"]);
  });

  it("requires both supported and enabled on runtime feature state", () => {
    expect(
      supportedAgentModes(
        makeFeatureState({
          planMode: featureToggle(true, false),
          composeMode: featureToggle(false, true),
        }),
      ),
    ).toEqual(["build"]);
    expect(supportedAgentModes(makeFeatureState())).toEqual(["build", "plan", "compose"]);
  });
});

describe("clampAgentModeByRuntime", () => {
  it("keeps requested mode when available", () => {
    expect(clampAgentModeByRuntime("plan", makeFeatureState(), null)).toBe("plan");
  });

  it("falls back when requested mode unavailable", () => {
    const state = makeFeatureState({
      planMode: featureToggle(false, false),
      composeMode: featureToggle(false, false),
    });
    expect(clampAgentModeByRuntime("plan", state, null, "compose")).toBe("build");
  });

  it("normalizes unknown values to build then clamps", () => {
    expect(clampAgentModeByRuntime("weird", null, { enabled: false })).toBe("build");
  });

  it("uses fallback when present in available set", () => {
    const state = makeFeatureState({
      planMode: featureToggle(false, false),
      composeMode: featureToggle(true, true),
    });
    expect(clampAgentModeByRuntime("plan", state, null, "compose")).toBe("compose");
  });
});

describe("isRuntimeFeatureEnabled", () => {
  it("uses longHorizon when featureState is null", () => {
    expect(
      isRuntimeFeatureEnabled(null, { enabled: true, memory: { enabled: true } }, "memory"),
    ).toBe(true);
    expect(
      isRuntimeFeatureEnabled(null, { enabled: false, memory: { enabled: true } }, "memory"),
    ).toBe(false);
  });

  it("requires supported+enabled on feature state", () => {
    const state = makeFeatureState({
      checkpoint: featureToggle(true, false),
      goal: featureToggle(false, true),
      task: featureToggle(true, true),
    });
    expect(isRuntimeFeatureEnabled(state, null, "checkpoint")).toBe(false);
    expect(isRuntimeFeatureEnabled(state, null, "goal")).toBe(false);
    expect(isRuntimeFeatureEnabled(state, null, "task")).toBe(true);
  });
});

describe("useRuntimeFeatureStore.refresh", () => {
  beforeEach(() => {
    useRuntimeFeatureStore.setState({
      featureState: null,
      loading: false,
      lastError: null,
      lastLoadedAt: null,
    });
    vi.unstubAllGlobals();
  });

  it("loads feature state from piAPI", async () => {
    const state = makeFeatureState();
    vi.stubGlobal("window", {
      piAPI: {
        runtimeFeatureState: vi.fn(async () => state),
      },
    });
    const result = await useRuntimeFeatureStore.getState().refresh();
    expect(result).toEqual(state);
    expect(useRuntimeFeatureStore.getState().featureState).toEqual(state);
    expect(useRuntimeFeatureStore.getState().lastError).toBeNull();
    expect(useRuntimeFeatureStore.getState().loading).toBe(false);
    expect(useRuntimeFeatureStore.getState().lastLoadedAt).toBeTypeOf("number");
  });

  it("records IPC errors without clearing existing state", async () => {
    const existing = makeFeatureState();
    useRuntimeFeatureStore.setState({ featureState: existing });
    vi.stubGlobal("window", {
      piAPI: {
        runtimeFeatureState: vi.fn(async () => ({
          code: "ERR",
          fallback: "runtime unavailable",
        })),
      },
    });
    const result = await useRuntimeFeatureStore.getState().refresh();
    expect(result).toEqual(existing);
    expect(useRuntimeFeatureStore.getState().lastError).toBe("runtime unavailable");
    expect(useRuntimeFeatureStore.getState().loading).toBe(false);
  });

  it("clearError resets lastError", () => {
    useRuntimeFeatureStore.setState({ lastError: "x" });
    useRuntimeFeatureStore.getState().clearError();
    expect(useRuntimeFeatureStore.getState().lastError).toBeNull();
  });
});

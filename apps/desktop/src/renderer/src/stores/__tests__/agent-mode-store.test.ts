/**
 * Agent mode store — workspace-scoped mode + runtime/long-horizon clamp (UX residual).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, MiMoCodeRuntimeFeatureState } from "@shared";

function createLocalStorageMock(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

function featureState(opts: {
  plan?: boolean;
  compose?: boolean;
}): MiMoCodeRuntimeFeatureState {
  const plan = opts.plan ?? true;
  const compose = opts.compose ?? true;
  const on = (enabled: boolean) => ({ supported: true, enabled });
  return {
    features: {
      planMode: on(plan),
      composeMode: on(compose),
      memory: on(true),
      history: on(true),
      checkpoint: on(true),
      goal: on(true),
      task: on(true),
      actor: on(true),
      subagents: on(true),
    },
  } as MiMoCodeRuntimeFeatureState;
}

describe("useAgentModeStore", () => {
  beforeEach(() => {
    vi.resetModules();
    const localStorage = createLocalStorageMock();
    (globalThis as { localStorage: Storage }).localStorage = localStorage;
    (globalThis as { window: unknown }).window = {
      localStorage,
      piAPI: {},
    };
  });

  async function loadStores() {
    const { useSettingsStore } = await import("../settings-store");
    const { useRuntimeFeatureStore } = await import("../runtime-feature-store");
    const { useAgentModeStore } = await import("../agent-mode-store");
    return { useSettingsStore, useRuntimeFeatureStore, useAgentModeStore };
  }

  it("defaults to build when workspace has no stored mode", async () => {
    const { useAgentModeStore } = await loadStores();
    useAgentModeStore.setState({ byWorkspace: {} });
    expect(useAgentModeStore.getState().getMode("ws-a")).toBe("build");
  });

  it("persists mode per workspace to localStorage", async () => {
    const { useAgentModeStore, useRuntimeFeatureStore, useSettingsStore } = await loadStores();
    useRuntimeFeatureStore.setState({ featureState: featureState({ plan: true, compose: true }) });
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        longHorizon: {
          ...useSettingsStore.getState().settings.longHorizon,
          enabled: true,
          planMode: { enabled: true },
          composeMode: { enabled: true },
        },
      } as AppSettings,
    });
    useAgentModeStore.setState({ byWorkspace: {} });
    useAgentModeStore.getState().setMode("ws-1", "plan");
    expect(useAgentModeStore.getState().getMode("ws-1")).toBe("plan");
    const raw = localStorage.getItem("pi-agent-modes");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toMatchObject({ "ws-1": "plan" });
  });

  it("clamps plan → build when plan mode is disabled in runtime features", async () => {
    const { useAgentModeStore, useRuntimeFeatureStore, useSettingsStore } = await loadStores();
    useRuntimeFeatureStore.setState({ featureState: featureState({ plan: false, compose: true }) });
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        longHorizon: {
          ...useSettingsStore.getState().settings.longHorizon,
          enabled: true,
          planMode: { enabled: false },
          composeMode: { enabled: true },
        },
      } as AppSettings,
    });
    useAgentModeStore.setState({ byWorkspace: {} });
    useAgentModeStore.getState().setMode("ws-1", "plan");
    expect(useAgentModeStore.getState().getMode("ws-1")).toBe("build");
  });

  it("clamps compose → build when compose mode is disabled", async () => {
    const { useAgentModeStore, useRuntimeFeatureStore, useSettingsStore } = await loadStores();
    useRuntimeFeatureStore.setState({ featureState: featureState({ plan: true, compose: false }) });
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        longHorizon: {
          ...useSettingsStore.getState().settings.longHorizon,
          enabled: true,
          planMode: { enabled: true },
          composeMode: { enabled: false },
        },
      } as AppSettings,
    });
    useAgentModeStore.setState({ byWorkspace: { "ws-1": "compose" } });
    // getMode re-clamps stored value against current runtime
    expect(useAgentModeStore.getState().getMode("ws-1")).toBe("build");
  });

  it("keeps workspaces independent", async () => {
    const { useAgentModeStore, useRuntimeFeatureStore } = await loadStores();
    useRuntimeFeatureStore.setState({ featureState: featureState({ plan: true, compose: true }) });
    useAgentModeStore.setState({ byWorkspace: {} });
    useAgentModeStore.getState().setMode("ws-a", "plan");
    useAgentModeStore.getState().setMode("ws-b", "compose");
    expect(useAgentModeStore.getState().getMode("ws-a")).toBe("plan");
    expect(useAgentModeStore.getState().getMode("ws-b")).toBe("compose");
  });
});

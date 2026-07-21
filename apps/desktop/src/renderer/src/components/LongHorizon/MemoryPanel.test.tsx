// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LongHorizonMemoryRecord } from "@shared";
import { I18nProvider } from "../../i18n";
import { MemoryPanel, recordMeta } from "./MemoryPanel";

const { useRuntimeFeatureStore, useSessionStore, useSettingsStore, useWorkspaceStore } = vi.hoisted(
  () => ({
    useRuntimeFeatureStore: vi.fn(),
    useSessionStore: vi.fn(),
    useSettingsStore: vi.fn(),
    useWorkspaceStore: vi.fn(),
  }),
);

vi.mock("../../stores/runtime-feature-store", () => ({
  useRuntimeFeatureStore,
  isRuntimeFeatureEnabled: (_fs: unknown, lh: { memory?: { enabled?: boolean } }) =>
    Boolean(lh?.memory?.enabled),
}));
vi.mock("../../stores/session-store", () => ({ useSessionStore }));
vi.mock("../../stores/settings-store", () => ({ useSettingsStore }));
vi.mock("../../stores/workspace-store", () => ({ useWorkspaceStore }));

const sampleRecord: LongHorizonMemoryRecord = {
  id: "r1",
  scope: "project",
  layer: "project_memory",
  kind: "note",
  text: "hello memory",
  createdAt: Date.now(),
};

describe("recordMeta", () => {
  it("joins layer/kind and optional score", () => {
    expect(
      recordMeta({
        ...sampleRecord,
        score: 0.5,
      }),
    ).toBe("project_memory · note · score 0.50");
  });
});

describe("MemoryPanel", () => {
  beforeEach(() => {
    useRuntimeFeatureStore.mockReturnValue({ featureState: {} });
    useSessionStore.mockImplementation((sel: (s: { currentSessionId: string | null }) => unknown) =>
      sel({ currentSessionId: "s1" }),
    );
    useWorkspaceStore.mockImplementation(
      (sel: (s: { getCurrentWorkspace: () => unknown }) => unknown) =>
        sel({ getCurrentWorkspace: () => ({ id: "w1", name: "Demo", path: "C:/demo" }) }),
    );
    window.piAPI = {
      memoryListRecent: vi.fn(async () => [sampleRecord]),
      memorySearch: vi.fn(async () => [] as LongHorizonMemoryRecord[]),
    } as never;
  });

  it("shows disabled state when memory feature is off", () => {
    useSettingsStore.mockImplementation(
      (sel: (s: { settings: { longHorizon: { memory: { enabled: boolean } } } }) => unknown) =>
        sel({ settings: { longHorizon: { memory: { enabled: false } } } }),
    );
    render(
      <I18nProvider>
        <MemoryPanel />
      </I18nProvider>,
    );
    expect(screen.getByText(/未启用 memory system/)).toBeTruthy();
  });

  it("lists recent memory records when enabled", async () => {
    useSettingsStore.mockImplementation(
      (sel: (s: { settings: { longHorizon: { memory: { enabled: boolean } } } }) => unknown) =>
        sel({ settings: { longHorizon: { memory: { enabled: true } } } }),
    );
    render(
      <I18nProvider>
        <MemoryPanel />
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByText("hello memory")).toBeTruthy());
    expect(window.piAPI.memoryListRecent).toHaveBeenCalled();
  });
});

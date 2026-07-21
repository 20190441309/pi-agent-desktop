import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    }),
  },
}));

vi.mock("electron-log/main", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { setupClaudeSessionsIpc } from "../claude-sessions.ipc";
import { setupCodexSessionsIpc } from "../codex-sessions.ipc";

describe("claude/codex session importer IPC wrappers", () => {
  beforeEach(() => {
    handlers.clear();
  });

  it("wires claude scan/import through the importer", async () => {
    const importer = {
      scan: vi.fn(async (p: string) => ({ scanned: p })),
      import: vi.fn(async (p: string, sources: string[]) => ({ p, sources })),
    };
    setupClaudeSessionsIpc(importer as never);

    await expect(handlers.get("claude-sessions:scan")!({}, "C:/ws")).resolves.toEqual({
      scanned: "C:/ws",
    });
    await expect(
      handlers.get("claude-sessions:import")!({}, "C:/ws", ["a.jsonl"]),
    ).resolves.toEqual({ p: "C:/ws", sources: ["a.jsonl"] });
  });

  it("wires codex scan/import through the importer", async () => {
    const importer = {
      scan: vi.fn(async (p: string) => ({ scanned: p, kind: "codex" })),
      import: vi.fn(async (p: string, sources: string[]) => ({ p, sources, kind: "codex" })),
    };
    setupCodexSessionsIpc(importer as never);

    await expect(handlers.get("codex-sessions:scan")!({}, "D:/repo")).resolves.toEqual({
      scanned: "D:/repo",
      kind: "codex",
    });
    await expect(
      handlers.get("codex-sessions:import")!({}, "D:/repo", ["b.jsonl"]),
    ).resolves.toEqual({ p: "D:/repo", sources: ["b.jsonl"], kind: "codex" });
  });
});

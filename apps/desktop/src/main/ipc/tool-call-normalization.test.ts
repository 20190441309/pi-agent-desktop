import { describe, expect, it } from "vitest";
import { normalizeLegacyMessagePayload } from "./tool-call-normalization";

describe("normalizeLegacyMessagePayload", () => {
  it("returns non-objects and messages without toolCalls unchanged", () => {
    expect(normalizeLegacyMessagePayload(null)).toBeNull();
    expect(normalizeLegacyMessagePayload("x")).toBe("x");
    expect(normalizeLegacyMessagePayload(42)).toBe(42);
    const bare = { id: "m1", content: "hi" };
    expect(normalizeLegacyMessagePayload(bare)).toBe(bare);
  });

  it("maps legacy toolCallId/toolName/args/result fields onto current shape", () => {
    const raw = {
      id: "msg-1",
      role: "assistant",
      toolCalls: [
        {
          toolCallId: "tc-legacy",
          toolName: "bash",
          args: { command: "ls" },
          result: "ok",
          status: "completed",
        },
      ],
    };
    const next = normalizeLegacyMessagePayload(raw) as {
      toolCalls: Array<Record<string, unknown>>;
    };
    expect(next.toolCalls[0]).toMatchObject({
      id: "tc-legacy",
      name: "bash",
      input: { command: "ls" },
      output: "ok",
      status: "completed",
      toolCallId: "tc-legacy",
      toolName: "bash",
    });
  });

  it("prefers legacy toolCallId/toolName when both legacy and modern keys exist", () => {
    const raw = {
      toolCalls: [
        {
          id: "modern-id",
          toolCallId: "legacy-id",
          name: "modern-name",
          toolName: "legacy-name",
          input: { a: 1 },
          args: { b: 2 },
          output: "out",
          result: "res",
        },
      ],
    };
    const next = normalizeLegacyMessagePayload(raw) as {
      toolCalls: Array<Record<string, unknown>>;
    };
    // Implementation: id = toolCallId ?? id, name = toolName ?? name, etc.
    expect(next.toolCalls[0].id).toBe("legacy-id");
    expect(next.toolCalls[0].name).toBe("legacy-name");
    expect(next.toolCalls[0].input).toEqual({ a: 1 });
    expect(next.toolCalls[0].output).toBe("out");
  });

  it("leaves non-object toolCalls entries as-is via identity pass-through", () => {
    const raw = {
      toolCalls: [null, "skip", 3, { toolCallId: "only-legacy" }],
    };
    const next = normalizeLegacyMessagePayload(raw) as { toolCalls: unknown[] };
    expect(next.toolCalls[0]).toBeNull();
    expect(next.toolCalls[1]).toBe("skip");
    expect(next.toolCalls[2]).toBe(3);
    expect(next.toolCalls[3]).toMatchObject({ id: "only-legacy", toolCallId: "only-legacy" });
  });

  it("does not mutate the original payload object", () => {
    const raw = {
      toolCalls: [{ toolCallId: "x", toolName: "y", args: {} }],
    };
    const snapshot = JSON.stringify(raw);
    normalizeLegacyMessagePayload(raw);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });
});

import { describe, expect, it } from "vitest";
import {
  normalizeToolCallForPersistence,
  normalizeToolCallForRuntime,
  normalizeToolCallsForPersistence,
  normalizeToolCallsForRuntime,
  readToolCallId,
  readToolCallInput,
  readToolCallIsError,
  readToolCallName,
  readToolCallOutput,
} from "../tool-call";

describe("tool-call SDK event readers", () => {
  it("reads a tool call from partial.content at contentIndex", () => {
    const event = {
      type: "toolcall_start",
      contentIndex: 1,
      partial: {
        content: [
          { type: "text", text: "starting" },
          {
            type: "toolCall",
            id: "tc_partial",
            name: "read",
            arguments: { path: "README.md" },
          },
        ],
      },
    };

    expect(readToolCallId(event)).toBe("tc_partial");
    expect(readToolCallName(event)).toBe("read");
    expect(readToolCallInput(event)).toEqual({ path: "README.md" });
  });

  it("reads a completed tool call from the top-level toolCall field", () => {
    const event = {
      type: "toolcall_end",
      toolCall: {
        type: "toolCall",
        id: "tc_complete",
        name: "bash",
        arguments: { command: "pwd" },
      },
    };

    expect(readToolCallId(event)).toBe("tc_complete");
    expect(readToolCallName(event)).toBe("bash");
    expect(readToolCallInput(event)).toEqual({ command: "pwd" });
  });

  it("reads output and error flags from completed payloads", () => {
    expect(readToolCallOutput({ output: "ok" })).toBe("ok");
    expect(readToolCallOutput({ result: { text: "r" } })).toEqual({ text: "r" });
    expect(readToolCallIsError({ isError: true })).toBe(true);
    // status "error" normalizes to error → isError true
    expect(readToolCallIsError({ status: "error" })).toBe(true);
    expect(readToolCallIsError({ status: "completed" })).toBe(false);
    expect(readToolCallIsError({})).toBe(false);
  });
});

describe("normalizeToolCallForRuntime / Persistence", () => {
  it("normalizes runtime tool calls with input/args/result", () => {
    const tool = normalizeToolCallForRuntime(
      {
        id: "tc1",
        name: "bash",
        status: "completed",
        arguments: { command: "ls" },
        result: "out",
        startTime: "2026-07-21T00:00:00.000Z",
        endTime: "2026-07-21T00:00:01.000Z",
      },
      "running",
    );
    expect(tool).toMatchObject({
      id: "tc1",
      name: "bash",
      status: "completed",
      input: { command: "ls" },
      args: { command: "ls" },
      result: "out",
    });
    expect(tool?.startTime).toBeInstanceOf(Date);
    expect(tool?.endTime).toBeInstanceOf(Date);
  });

  it("returns null when id or name missing", () => {
    expect(normalizeToolCallForRuntime({ name: "x" })).toBeNull();
    expect(normalizeToolCallForRuntime({ id: "1" })).toBeNull();
    expect(normalizeToolCallForRuntime(null)).toBeNull();
  });

  it("persistence omits args/result while keeping input/output timestamps", () => {
    const persisted = normalizeToolCallForPersistence({
      id: "tc2",
      name: "read",
      status: "completed",
      input: { path: "a.ts" },
      args: { path: "a.ts" },
      result: "ignored-in-persist-shape-if-only-result",
      output: "file body",
      startTime: new Date("2026-07-21T00:00:00.000Z"),
      endTime: new Date("2026-07-21T00:00:02.000Z"),
    });
    expect(persisted).toMatchObject({
      id: "tc2",
      name: "read",
      status: "completed",
      input: { path: "a.ts" },
      output: "file body",
    });
    expect(persisted).not.toHaveProperty("args");
    expect(persisted).not.toHaveProperty("result");
  });

  it("batch helpers filter invalid entries", () => {
    expect(normalizeToolCallsForRuntime(null)).toEqual([]);
    expect(
      normalizeToolCallsForRuntime([
        { id: "a", name: "read" },
        { id: "bad" },
        { name: "only-name" },
      ]),
    ).toHaveLength(1);
    expect(normalizeToolCallsForPersistence([{ id: "a", name: "read", args: { x: 1 } }])[0]).not.toHaveProperty(
      "args",
    );
  });
});

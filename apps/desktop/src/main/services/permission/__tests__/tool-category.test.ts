import { describe, expect, it } from "vitest";
import {
  classifyToolName,
  isCoreTool,
  isModeRequiredTool,
  normalizeToolName,
} from "../tool-category";

describe("tool-category", () => {
  it("normalizeToolName trims and lowercases", () => {
    expect(normalizeToolName("  Read  ")).toBe("read");
    expect(normalizeToolName("BASH")).toBe("bash");
  });

  it("classifies known tool families", () => {
    expect(classifyToolName("read")).toBe("fileRead");
    expect(classifyToolName("Grep")).toBe("fileRead");
    expect(classifyToolName("write")).toBe("fileWrite");
    expect(classifyToolName("apply_patch")).toBe("fileWrite");
    expect(classifyToolName("bash")).toBe("shell");
    expect(classifyToolName("shell")).toBe("shell");
    expect(classifyToolName("webfetch")).toBe("network");
    expect(classifyToolName("custom_http_tool")).toBe("network");
    expect(classifyToolName("my-plugin-tool")).toBe("extension");
  });

  it("identifies core tools", () => {
    expect(isCoreTool("read")).toBe(true);
    expect(isCoreTool("edit")).toBe(true);
    expect(isCoreTool("bash")).toBe(true);
    expect(isCoreTool("webfetch")).toBe(false);
    expect(isCoreTool("unknown")).toBe(false);
  });

  it("requires plan_write only in plan mode", () => {
    expect(isModeRequiredTool("plan_write", "plan")).toBe(true);
    expect(isModeRequiredTool("plan_write", "agent")).toBe(false);
    expect(isModeRequiredTool("write", "plan")).toBe(false);
  });
});

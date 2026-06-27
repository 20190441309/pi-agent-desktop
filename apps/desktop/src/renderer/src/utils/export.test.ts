import { describe, expect, it } from "vitest";
import type { Session } from "../stores/session-store";
import { exportSessionAsMarkdown } from "./export";

describe("session export", () => {
  it("omits estimated cost from markdown usage statistics", () => {
    const markdown = exportSessionAsMarkdown({
      id: "s1",
      title: "Token export",
      workspaceId: "w1",
      createdAt: new Date("2026-06-27T00:00:00.000Z"),
      updatedAt: new Date("2026-06-27T00:00:00.000Z"),
      messages: [],
      usage: {
        inputTokens: 1200,
        outputTokens: 300,
        totalTokens: 1500,
        estimatedCostUsd: 0.0123,
        updatedAt: new Date("2026-06-27T00:00:00.000Z").getTime(),
      },
    } satisfies Session);

    expect(markdown).toContain("- 总 Token: 1500");
    expect(markdown).not.toContain("预估费用");
    expect(markdown).not.toContain("$0.01");
  });
});

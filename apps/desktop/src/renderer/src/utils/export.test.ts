import { describe, expect, it } from "vitest";
import type { Session } from "../stores/session-store";
import { exportSessionAsHTML, exportSessionAsMarkdown } from "./export";

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

  it("includes generated ui text in markdown and html exports", () => {
    const session = {
      id: "s2",
      title: "Generated UI export",
      workspaceId: "w1",
      createdAt: new Date("2026-07-03T00:00:00.000Z"),
      updatedAt: new Date("2026-07-03T00:00:00.000Z"),
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "",
          timestamp: new Date("2026-07-03T00:00:00.000Z"),
          generatedUi: {
            version: "v1",
            id: "ui-export",
            title: "交付结果",
            sections: [
              { id: "summary", kind: "summary", content: "已生成报告" },
              { id: "facts", kind: "key_value", items: [{ id: "k1", key: "文件", value: "docs/report.md" }] },
            ],
          },
        },
      ],
    } satisfies Session;

    const markdown = exportSessionAsMarkdown(session);
    const html = exportSessionAsHTML(session);

    expect(markdown).toContain("交付结果");
    expect(markdown).toContain("已生成报告");
    expect(markdown).toContain("文件: docs/report.md");
    expect(html).toContain("交付结果");
    expect(html).toContain("文件: docs/report.md");
  });
});

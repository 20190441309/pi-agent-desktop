import { describe, expect, it } from "vitest";
import type { Session } from "../stores/session-store";
import { sessionMatches } from "./session-grouping";

describe("sessionMatches", () => {
  it("matches generated ui text when message content is empty", () => {
    const session = {
      id: "s1",
      title: "Generated UI session",
      workspaceId: "w1",
      createdAt: new Date(0),
      updatedAt: new Date(0),
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "",
          timestamp: new Date(0),
          generatedUi: {
            version: "v1",
            id: "ui-grouping",
            title: "交付结果",
            sections: [
              { id: "summary", kind: "summary", content: "已生成 docs/report.md" },
            ],
          },
        },
      ],
    } satisfies Session;

    expect(sessionMatches(session, "report.md")).toBe(true);
  });
});

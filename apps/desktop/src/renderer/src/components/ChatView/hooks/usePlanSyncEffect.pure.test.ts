import { describe, expect, it } from "vitest";
import {
  findReusablePlanSourceMessage,
  normalizePlanText,
} from "./usePlanSyncEffect";

describe("normalizePlanText", () => {
  it("strips frontmatter, think blocks, and collapses whitespace", () => {
    const raw = `---\ntitle: plan\n---\n\nHello   World\n<think>secret</think>\nDone`;
    expect(normalizePlanText(raw)).toBe("hello world done");
  });

  it("strips unclosed trailing think blocks", () => {
    expect(normalizePlanText("Plan A <think>still thinking")).toBe("plan a");
  });
});

describe("findReusablePlanSourceMessage", () => {
  it("returns undefined for empty target or no match", () => {
    expect(findReusablePlanSourceMessage([], "x")).toBeUndefined();
    expect(
      findReusablePlanSourceMessage(
        [{ id: "1", role: "user", content: "plan body" }],
        "plan body",
      ),
    ).toBeUndefined();
  });

  it("matches the newest assistant message with normalized equal body", () => {
    const messages = [
      { id: "old", role: "assistant", content: "Plan Body" },
      {
        id: "locked",
        role: "assistant",
        content: "Plan Body",
        planAction: { id: "p1", title: "Plan", status: "executing" as const },
      },
      { id: "new", role: "assistant", content: "  plan   body  " },
    ];
    // planAction messages are skipped; newest plain assistant match wins
    expect(findReusablePlanSourceMessage(messages, "PLAN BODY")?.id).toBe("new");
  });

  it("skips assistant messages that already carry planAction", () => {
    const messages = [
      {
        id: "with-action",
        role: "assistant",
        content: "same",
        planAction: { id: "p2", title: "Same", status: "executed" as const },
      },
    ];
    expect(findReusablePlanSourceMessage(messages, "same")).toBeUndefined();
  });
});

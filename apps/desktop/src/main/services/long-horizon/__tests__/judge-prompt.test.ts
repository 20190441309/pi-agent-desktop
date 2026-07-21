import { describe, expect, it } from "vitest";
import { JUDGE_SYSTEM, VerdictSchema, judgeUser } from "../judge-prompt";

describe("judge-prompt", () => {
  it("exposes judge system prompt with JSON shapes", () => {
    expect(JUDGE_SYSTEM).toContain('"ok": true');
    expect(JUDGE_SYSTEM).toContain('"impossible": true');
    expect(JUDGE_SYSTEM).toContain("reason");
  });

  it("builds user condition prompt", () => {
    const text = judgeUser("all tests pass");
    expect(text).toContain("all tests pass");
    expect(text).toContain("stopping condition");
    expect(text).toContain("transcript evidence");
  });

  it("parses valid verdicts via Zod schema", () => {
    expect(VerdictSchema.parse({ ok: true, reason: "done" })).toEqual({
      ok: true,
      reason: "done",
    });
    expect(
      VerdictSchema.parse({ ok: false, impossible: true, reason: "blocked" }),
    ).toEqual({ ok: false, impossible: true, reason: "blocked" });
  });

  it("rejects verdicts missing reason", () => {
    expect(() => VerdictSchema.parse({ ok: true })).toThrow();
    expect(() => VerdictSchema.parse({ ok: false, reason: 1 })).toThrow();
  });
});

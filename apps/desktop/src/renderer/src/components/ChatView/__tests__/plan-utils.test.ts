import { describe, expect, it } from "vitest";
import {
  findReusablePlanMessage,
  isLockedPlanPhase,
  isReusablePlanStatus,
  normalizePlanIdentity,
  samePlanIdentity,
  stripPlanFrontmatter,
} from "../plan-utils";

describe("normalizePlanIdentity", () => {
  it("trims and lowercases", () => {
    expect(normalizePlanIdentity("  Plan-ABC.md ")).toBe("plan-abc.md");
  });

  it("maps undefined/empty to empty string", () => {
    expect(normalizePlanIdentity(undefined)).toBe("");
    expect(normalizePlanIdentity("   ")).toBe("");
  });
});

describe("samePlanIdentity", () => {
  it("matches on filename when both present (case-insensitive)", () => {
    expect(
      samePlanIdentity(
        { filename: "Plan/FOO.md", title: "A" },
        { filename: "plan/foo.md", title: "B" },
      ),
    ).toBe(true);
  });

  it("does not match when filenames differ even if titles match", () => {
    expect(
      samePlanIdentity(
        { filename: "a.md", title: "same" },
        { filename: "b.md", title: "same" },
      ),
    ).toBe(false);
  });

  it("falls back to title when either filename is missing", () => {
    expect(
      samePlanIdentity({ title: "  Write Probe " }, { filename: "x.md", title: "write probe" }),
    ).toBe(true);
    expect(samePlanIdentity({ title: "A" }, { title: "B" })).toBe(false);
  });

  it("returns false when neither side has a usable identity", () => {
    expect(samePlanIdentity({}, {})).toBe(false);
    expect(samePlanIdentity({ title: "  " }, { filename: "" })).toBe(false);
  });
});

describe("isLockedPlanPhase", () => {
  it("locks executing/pausing/paused/completed", () => {
    expect(isLockedPlanPhase("executing")).toBe(true);
    expect(isLockedPlanPhase("pausing")).toBe(true);
    expect(isLockedPlanPhase("paused")).toBe(true);
    expect(isLockedPlanPhase("completed")).toBe(true);
  });

  it("does not lock draft/idle/unknown", () => {
    expect(isLockedPlanPhase("draft")).toBe(false);
    expect(isLockedPlanPhase(undefined)).toBe(false);
    expect(isLockedPlanPhase("")).toBe(false);
  });
});

describe("isReusablePlanStatus", () => {
  it("rejects terminal statuses", () => {
    expect(isReusablePlanStatus("executed")).toBe(false);
    expect(isReusablePlanStatus("cancelled")).toBe(false);
    expect(isReusablePlanStatus("failed")).toBe(false);
  });

  it("allows non-terminal and undefined", () => {
    expect(isReusablePlanStatus("pending")).toBe(true);
    expect(isReusablePlanStatus("refining")).toBe(true);
    expect(isReusablePlanStatus("executing")).toBe(true);
    expect(isReusablePlanStatus(undefined)).toBe(true);
  });
});

describe("findReusablePlanMessage", () => {
  const messages = [
    {
      id: "m1",
      planAction: { status: "pending" as const, title: "Old", filename: "old.md" },
    },
    {
      id: "m2",
      planAction: { status: "executed" as const, title: "Done", filename: "done.md" },
    },
    {
      id: "m3",
      planAction: { status: "pending" as const, title: "Probe", filename: "probe.md" },
    },
    {
      id: "m4",
      planAction: { status: "failed" as const, title: "Probe", filename: "probe.md" },
    },
  ];

  it("prefers preferredMessageId when reusable and identity matches", () => {
    const found = findReusablePlanMessage(messages, { filename: "probe.md" }, "m3");
    expect(found?.id).toBe("m3");
  });

  it("ignores preferred id when status is not reusable", () => {
    const found = findReusablePlanMessage(messages, { filename: "probe.md" }, "m4");
    // m4 failed → reverse scan finds m3
    expect(found?.id).toBe("m3");
  });

  it("reverse-scans to the newest reusable match", () => {
    const found = findReusablePlanMessage(
      [
        ...messages,
        {
          id: "m5",
          planAction: { status: "refining" as const, title: "Probe", filename: "probe.md" },
        },
      ],
      { filename: "probe.md" },
    );
    expect(found?.id).toBe("m5");
  });

  it("returns undefined when only terminal statuses match", () => {
    const found = findReusablePlanMessage(
      [{ id: "x", planAction: { status: "executed" as const, title: "X", filename: "x.md" } }],
      { filename: "x.md" },
    );
    expect(found).toBeUndefined();
  });
});

describe("stripPlanFrontmatter edge cases", () => {
  it("supports CRLF frontmatter delimiters", () => {
    const raw = "---\r\ntitle: x\r\n---\r\nbody line\r\n";
    expect(stripPlanFrontmatter(raw)).toBe("body line");
  });

  it("does not strip mid-document horizontal rules", () => {
    const raw = "# Title\n\n---\n\nstill here";
    expect(stripPlanFrontmatter(raw)).toBe(raw);
  });
});

import { describe, expect, it } from "vitest";
import type { DiffLine } from "./diff-parser";
import { splitHunkLines } from "./DiffViewer";

function ctx(oldLine: number, newLine: number, content = "ctx"): DiffLine {
  return { type: "context", oldLine, newLine, content };
}

function add(newLine: number, content = "add"): DiffLine {
  return { type: "add", oldLine: null, newLine, content };
}

function rem(oldLine: number, content = "rem"): DiffLine {
  return { type: "remove", oldLine, newLine: null, content };
}

describe("splitHunkLines", () => {
  it("keeps short context runs unfolded", () => {
    const lines = [ctx(1, 1), ctx(2, 2), add(3), ctx(3, 4)];
    const segments = splitHunkLines(lines);
    expect(segments.every((s) => s.type === "lines")).toBe(true);
    expect(segments.flatMap((s) => (s.type === "lines" ? s.lines : [])).length).toBe(4);
  });

  it("folds long context runs with head/tail kept", () => {
    // CONTEXT_EXPAND = 3 → need > 7 consecutive context lines to fold
    const lines: DiffLine[] = [];
    for (let i = 1; i <= 10; i++) lines.push(ctx(i, i, `c${i}`));
    lines.push(add(11, "+x"));
    const segments = splitHunkLines(lines);
    expect(segments.some((s) => s.type === "fold")).toBe(true);
    const fold = segments.find((s) => s.type === "fold");
    expect(fold && fold.type === "fold" ? fold.count : 0).toBe(4); // 10 - 3 - 3
    // change line still present after fold
    const lastLines = segments[segments.length - 1];
    expect(lastLines?.type).toBe("lines");
    if (lastLines?.type === "lines") {
      expect(lastLines.lines.some((l) => l.type === "add")).toBe(true);
    }
  });

  it("does not fold mixed change lines", () => {
    const lines = [rem(1), add(1), rem(2), add(2)];
    const segments = splitHunkLines(lines);
    expect(segments).toHaveLength(4);
    expect(segments.every((s) => s.type === "lines")).toBe(true);
  });
});

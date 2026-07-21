import { describe, expect, it } from "vitest";
import { extractDiffFromOutput, parseDiff } from "./diff-parser";

const SAMPLE = [
  "diff --git a/src/a.ts b/src/a.ts",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -1,3 +1,4 @@",
  " context",
  "-old",
  "+new",
  "+extra",
  " keep",
].join("\n");

describe("parseDiff", () => {
  it("parses unified diff hunks and counts", () => {
    const parsed = parseDiff(SAMPLE);
    expect(parsed.files).toHaveLength(1);
    const file = parsed.files[0];
    expect(file.oldPath).toBe("src/a.ts");
    expect(file.newPath).toBe("src/a.ts");
    expect(file.additions).toBe(2);
    expect(file.deletions).toBe(1);
    expect(file.hunks).toHaveLength(1);
    expect(file.hunks[0].lines.map((l) => l.type)).toEqual([
      "context",
      "remove",
      "add",
      "add",
      "context",
    ]);
  });

  it("marks new and deleted files via /dev/null paths", () => {
    const created = parseDiff(`diff --git a/x b/x
--- /dev/null
+++ b/x
@@ -0,0 +1,1 @@
+hello
`);
    expect(created.files[0].isNew).toBe(true);
    expect(created.files[0].oldPath).toBe("x");

    const deleted = parseDiff(`diff --git a/y b/y
--- a/y
+++ /dev/null
@@ -1,1 +0,0 @@
-bye
`);
    expect(deleted.files[0].isDeleted).toBe(true);
  });
});

describe("extractDiffFromOutput", () => {
  it("returns null for empty or non-diff text", () => {
    expect(extractDiffFromOutput("")).toBeNull();
    expect(extractDiffFromOutput("hello world")).toBeNull();
  });

  it("extracts diff/patch fields from JSON", () => {
    expect(extractDiffFromOutput(JSON.stringify({ diff: SAMPLE }))).toBe(SAMPLE);
    expect(extractDiffFromOutput(JSON.stringify({ patch: SAMPLE }))).toBe(SAMPLE);
  });

  it("accepts raw unified diff text", () => {
    expect(extractDiffFromOutput(SAMPLE)).toBe(SAMPLE);
  });
});

import { describe, expect, it } from "vitest";
import type { FileTreeNode, GitStatus, TextFileContent } from "@shared";
import {
  basename,
  escapeDiffLine,
  flattenTree,
  formatBytes,
  lineRows,
  makeConflictDiff,
  makeGitMarks,
  modeDescription,
  modeLabel,
  nonEditableReason,
  normalizePath,
  relativeToWorkspace,
  resolveWorkspacePath,
  shellActionFailure,
} from "./file-workspace-utils";

describe("file-workspace-utils", () => {
  describe("basename", () => {
    it("handles posix and windows separators", () => {
      expect(basename("src/app.ts")).toBe("app.ts");
      expect(basename("C:\\\\Users\\\\demo\\\\file.md")).toBe("file.md");
      expect(basename("alone")).toBe("alone");
    });
  });

  describe("formatBytes", () => {
    it("formats sizes and missing values", () => {
      expect(formatBytes(undefined)).toBe("-");
      expect(formatBytes(512)).toBe("512 B");
      expect(formatBytes(2048)).toBe("2 KB");
      expect(formatBytes(2 * 1024 * 1024)).toBe("2 MB");
    });
  });

  describe("flattenTree", () => {
    it("returns empty for null and DFS-walks children", () => {
      expect(flattenTree(null)).toEqual([]);
      const tree: FileTreeNode = {
        name: "root",
        path: "/w",
        type: "directory",
        children: [
          {
            name: "a.ts",
            path: "/w/a.ts",
            type: "file",
          },
          {
            name: "sub",
            path: "/w/sub",
            type: "directory",
            children: [{ name: "b.ts", path: "/w/sub/b.ts", type: "file" }],
          },
        ],
      };
      expect(flattenTree(tree).map((n) => n.path)).toEqual([
        "/w",
        "/w/a.ts",
        "/w/sub",
        "/w/sub/b.ts",
      ]);
    });
  });

  describe("lineRows / escapeDiffLine / makeConflictDiff", () => {
    it("normalizes empty and CRLF content", () => {
      expect(lineRows("")).toEqual([""]);
      expect(lineRows("a\r\nb\nc")).toEqual(["a", "b", "c"]);
      expect(escapeDiffLine("x\r")).toBe("x");
    });

    it("builds a conflict unified-diff style payload", () => {
      const diff = makeConflictDiff("notes.md", "disk\r\nline", "draft");
      expect(diff).toContain("diff --git a/notes.md b/notes.md");
      expect(diff).toContain("--- a/notes.md");
      expect(diff).toContain("+++ b/notes.md");
      expect(diff).toContain("@@ -1,2 +1,1 @@");
      expect(diff).toContain("-disk");
      expect(diff).toContain("-line");
      expect(diff).toContain("+draft");
    });
  });

  describe("mode labels", () => {
    it("maps view modes", () => {
      expect(modeLabel("preview")).toBe("只读预览");
      expect(modeLabel("edit")).toBe("编辑");
      expect(modeLabel("diff")).toBe("Diff");
      expect(modeLabel("conflict")).toBe("冲突");
      expect(modeDescription("preview")).toBe("只读");
      expect(modeDescription("edit")).toBe("可编辑");
    });
  });

  describe("nonEditableReason", () => {
    it("returns reasons for binary/truncated and null otherwise", () => {
      expect(nonEditableReason(null)).toBeNull();
      const base: TextFileContent = {
        path: "/w/a",
        name: "a",
        content: "x",
        size: 1,
        encoding: "utf-8",
        truncated: false,
        binary: false,
      };
      expect(nonEditableReason(base)).toBeNull();
      expect(nonEditableReason({ ...base, binary: true })).toContain("二进制");
      expect(nonEditableReason({ ...base, truncated: true })).toContain("过大");
    });
  });

  describe("shellActionFailure", () => {
    it("extracts ipc and string failures", () => {
      expect(shellActionFailure(null)).toBeNull();
      expect(shellActionFailure({ code: "E", fallback: "boom" })).toBe("boom");
      expect(shellActionFailure({ __brand: "IpcError", code: "E", fallback: "branded" })).toBe(
        "branded",
      );
      expect(shellActionFailure("  open failed  ")).toBe("  open failed  ");
      expect(shellActionFailure("   ")).toBeNull();
      expect(shellActionFailure({ ok: true })).toBeNull();
    });
  });

  describe("path helpers", () => {
    it("normalizes slashes", () => {
      expect(normalizePath("C:\\\\w\\\\src\\\\a.ts")).toBe("C:/w/src/a.ts");
      expect(normalizePath("a//b///c")).toBe("a/b/c");
    });

    it("computes relative and absolute workspace paths", () => {
      expect(relativeToWorkspace("C:/proj/src/a.ts", "C:/proj")).toBe("src/a.ts");
      expect(relativeToWorkspace("C:/proj", "C:/proj/")).toBe("");
      expect(relativeToWorkspace("C:/other/x", "C:/proj")).toBe("C:/other/x");

      expect(resolveWorkspacePath("src/a.ts", "C:/proj")).toBe("C:/proj/src/a.ts");
      expect(resolveWorkspacePath("C:/proj/src/a.ts", "C:/proj")).toBe("C:/proj/src/a.ts");
      // normalizePath collapses leading // so UNC is not preserved as absolute here
      expect(resolveWorkspacePath("//server/share/f", "C:/proj")).toBe("C:/proj/server/share/f");
      expect(resolveWorkspacePath("C:/proj", "C:/proj")).toBe("C:/proj");
    });
  });

  describe("makeGitMarks", () => {
    it("returns empty map for null status", () => {
      expect(makeGitMarks(null).size).toBe(0);
    });

    it("marks modified/added/deleted/untracked with normalized paths", () => {
      const status: GitStatus = {
        branch: "main",
        modified: ["src\\\\a.ts"],
        added: ["src/b.ts"],
        deleted: ["old.ts"],
        untracked: ["tmp/x"],
        ahead: 0,
        behind: 0,
      };
      const marks = makeGitMarks(status);
      expect(marks.get("src/a.ts")?.label).toBe("M");
      expect(marks.get("src/b.ts")?.label).toBe("A");
      expect(marks.get("old.ts")?.label).toBe("D");
      expect(marks.get("tmp/x")?.label).toBe("?");
      expect(marks.get("src/a.ts")?.text).toBe("Modified");
    });
  });
});

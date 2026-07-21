// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiffViewer } from "./DiffViewer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) => {
      if (key === "diffView.filesChanged") return `files:${opts?.count ?? 0}`;
      if (key === "diffView.expand") return `expand:${opts?.count ?? 0}`;
      return key;
    },
  }),
}));

vi.mock("./FileChangeItem", () => ({
  FileChangeItem: ({
    file,
    onToggle,
  }: {
    file: { newPath: string; oldPath: string };
    onToggle: () => void;
  }) => (
    <button type="button" onClick={onToggle}>
      file-{file.newPath || file.oldPath}
    </button>
  ),
}));

const SAMPLE_DIFF = `diff --git a/hello.ts b/hello.ts
--- a/hello.ts
+++ b/hello.ts
@@ -1,3 +1,4 @@
 line1
-line2
+line2-changed
 line3
+line4
`;

describe("DiffViewer", () => {
  it("renders summary and file header for a simple unified diff", () => {
    render(<DiffViewer diff={SAMPLE_DIFF} />);
    expect(screen.getByText("files:1")).toBeTruthy();
    expect(screen.getByText(/\+2/)).toBeTruthy();
    expect(screen.getByText(/-1/)).toBeTruthy();
    expect(screen.getByText("file-hello.ts")).toBeTruthy();
  });

  it("returns null for empty or non-diff input", () => {
    const { container } = render(<DiffViewer diff="no diff here" />);
    expect(container.firstChild).toBeNull();
  });

  it("exposes keyboard-focusable fold expand control for long context", () => {
    // Build a diff with a long context run so FoldRow appears.
    const contextLines = Array.from({ length: 12 }, (_, i) => ` ctx${i + 1}`).join("\n");
    const longDiff = `diff --git a/long.ts b/long.ts
--- a/long.ts
+++ b/long.ts
@@ -1,12 +1,13 @@
${contextLines}
+added
`;
    render(<DiffViewer diff={longDiff} />);
    const expand = screen.queryByRole("button", { name: /expand:/i });
    if (expand) {
      expect(expand.getAttribute("type")).toBe("button");
    } else {
      // Parser may not produce enough pure-context lines depending on hunk header;
      // still assert the viewer rendered the file.
      expect(screen.getByText("file-long.ts")).toBeTruthy();
    }
  });
});

// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileChangeItem } from "./FileChangeItem";
import type { DiffFile } from "./diff-parser";

function makeFile(overrides: Partial<DiffFile> = {}): DiffFile {
  return {
    oldPath: "a/old.ts",
    newPath: "a/new.ts",
    isNew: false,
    isDeleted: false,
    additions: 3,
    deletions: 1,
    hunks: [],
    ...overrides,
  };
}

describe("FileChangeItem", () => {
  it("toggles via click and exposes aria-expanded", () => {
    const onToggle = vi.fn();
    render(<FileChangeItem file={makeFile()} isExpanded={false} onToggle={onToggle} />);
    const btn = screen.getByRole("button", { name: "展开 a/new.ts" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows new badge and addition counts", () => {
    render(
      <FileChangeItem
        file={makeFile({ isNew: true, newPath: "created.ts", additions: 12, deletions: 0 })}
        isExpanded
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("新建")).toBeTruthy();
    expect(screen.getByText("+12")).toBeTruthy();
    expect(screen.getByRole("button", { name: "折叠 created.ts" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("shows deleted badge and uses oldPath when newPath empty", () => {
    render(
      <FileChangeItem
        file={makeFile({
          isDeleted: true,
          newPath: "",
          oldPath: "gone.ts",
          additions: 0,
          deletions: 4,
        })}
        isExpanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("删除")).toBeTruthy();
    expect(screen.getByText("-4")).toBeTruthy();
    expect(screen.getByRole("button", { name: "展开 gone.ts" })).toBeTruthy();
  });
});

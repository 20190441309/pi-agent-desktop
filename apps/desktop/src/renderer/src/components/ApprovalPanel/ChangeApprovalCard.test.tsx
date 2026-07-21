// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChangeApprovalCard } from "./ChangeApprovalCard";
import type { PendingChange } from "../../stores/approval-store";

vi.mock("../DiffView", () => ({
  DiffViewer: ({ diff }: { diff: string }) => <pre data-testid="diff-viewer">{diff}</pre>,
}));

function makeChange(overrides: Partial<PendingChange> = {}): PendingChange {
  return {
    id: "change_1",
    toolCallId: "tc_1",
    toolName: "write",
    filePath: "src/app/main.ts",
    status: "pending",
    timestamp: new Date("2026-07-21T00:00:00Z"),
    ...overrides,
  };
}

describe("ChangeApprovalCard", () => {
  it("renders file path, write badge, and approval actions with a11y labels", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <ChangeApprovalCard
        change={makeChange({ diff: "@@ +1 @@" })}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    expect(screen.getByText("main.ts")).toBeTruthy();
    expect(screen.getByText("新建/覆盖")).toBeTruthy();
    expect(screen.getByTestId("diff-viewer").textContent).toBe("@@ +1 @@");

    const reject = screen.getByRole("button", { name: "拒绝变更 src/app/main.ts" });
    const approve = screen.getByRole("button", { name: "接受变更 src/app/main.ts" });
    expect(reject.getAttribute("type")).toBe("button");
    expect(approve.getAttribute("type")).toBe("button");

    fireEvent.click(reject);
    fireEvent.click(approve);
    expect(onReject).toHaveBeenCalledWith("change_1");
    expect(onApprove).toHaveBeenCalledWith("change_1");
  });

  it("shows edit summary and hides actions after decision", () => {
    render(
      <ChangeApprovalCard
        change={makeChange({
          toolName: "edit",
          status: "approved",
          oldString: "const a = 1",
          newString: "const a = 2",
        })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText("编辑")).toBeTruthy();
    expect(screen.getByText("已接受")).toBeTruthy();
    expect(screen.getByText("const a = 1")).toBeTruthy();
    expect(screen.getByText("const a = 2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /接受变更/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /拒绝变更/ })).toBeNull();
  });

  it("shows rejected status badge without action buttons", () => {
    render(
      <ChangeApprovalCard
        change={makeChange({ status: "rejected", filePath: "gone.ts" })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText("已拒绝")).toBeTruthy();
    expect(screen.getByText("gone.ts")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

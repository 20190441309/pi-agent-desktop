// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceNoticeBanner, emitWorkspaceNotice } from "./WorkspaceNoticeBanner";

describe("WorkspaceNoticeBanner", () => {
  it("shows and dismisses workspace route notices", async () => {
    render(<WorkspaceNoticeBanner />);

    act(() => {
      emitWorkspaceNotice({ message: "切换工作区失败: path missing", tone: "error" });
    });

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("切换工作区失败: path missing");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "关闭工作区提示" }));
    });

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

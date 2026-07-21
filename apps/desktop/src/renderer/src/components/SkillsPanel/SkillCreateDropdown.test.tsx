// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillCreateDropdown } from "./SkillCreateDropdown";

describe("SkillCreateDropdown", () => {
  it("opens menu and invokes build/write/import callbacks", () => {
    const onBuildWithPi = vi.fn();
    const onWriteDirect = vi.fn();
    const onImportFromGitHub = vi.fn();
    render(
      <SkillCreateDropdown
        onBuildWithPi={onBuildWithPi}
        onWriteDirect={onWriteDirect}
        onImportFromGitHub={onImportFromGitHub}
      />,
    );

    const trigger = screen.getByRole("button", { name: "创建技能" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.click(screen.getByRole("menuitem", { name: /用 Pi 构建/ }));
    expect(onBuildWithPi).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: /编写技能/ }));
    expect(onWriteDirect).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: /从 Github 导入/ }));
    expect(onImportFromGitHub).toHaveBeenCalledTimes(1);
  });

  it("closes on outside mousedown", () => {
    render(<SkillCreateDropdown onBuildWithPi={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "创建技能" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

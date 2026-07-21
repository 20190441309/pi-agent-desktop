// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillCard } from "./SkillCard";
import type { SkillInfo } from "../../../../main/services/skills/skillhub-adapter";

const skill: SkillInfo = {
  slug: "demo-skill",
  name: "Demo Skill",
  description: "A".repeat(140),
  version: "1.2.3",
  source: "skillhub",
};

describe("SkillCard", () => {
  it("truncates long description and shows install button when not installed", () => {
    const onInstall = vi.fn();
    render(<SkillCard skill={skill} onInstall={onInstall} />);
    expect(screen.getByText("Demo Skill")).toBeTruthy();
    expect(screen.getByText(/A{120}\.\.\./)).toBeTruthy();
    expect(screen.getByText("@demo-skill")).toBeTruthy();
    expect(screen.getByText("skillhub")).toBeTruthy();
    const btn = screen.getByRole("button", { name: "安装 Demo Skill" });
    fireEvent.click(btn);
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("shows installed state without install button", () => {
    render(<SkillCard skill={skill} installed />);
    expect(screen.getByText("✓ 已装")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /安装/ })).toBeNull();
  });

  it("disables install button while installing", () => {
    render(<SkillCard skill={skill} isInstalling onInstall={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "安装 Demo Skill" });
    expect(btn).toHaveProperty("disabled", true);
    expect(btn.textContent).toContain("安装中");
  });
});

// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SkillsPanel } from "./SkillsPanel";
import { useSkillsStore } from "../../stores/skills-store";
import { usePiPackagesStore } from "../../stores/pi-packages-store";

vi.mock("./SkillsMarketplace", () => ({
  SkillsMarketplace: () => <div>market</div>,
}));

vi.mock("./PiPackagesMarketplace", () => ({
  PiPackagesMarketplace: () => <div>pi market</div>,
}));

vi.mock("./InstalledAddons", () => ({
  InstalledAddons: () => <div>installed</div>,
}));

describe("SkillsPanel", () => {
  beforeEach(() => {
    useSkillsStore.setState({
      marketQuery: "",
      marketResults: [],
      marketLoading: false,
      installed: [],
      installedLoading: false,
      error: null,
    });
    usePiPackagesStore.setState({
      query: "",
      results: [],
      installed: [],
      loading: false,
      installedLoading: false,
      actionSource: null,
      error: null,
      lastAction: null,
    });
    Object.defineProperty(window, "piAPI", {
      value: {
        skillsGithubImport: vi.fn(async () => ({
          success: true,
          path: "C:/Users/user/.agents/skills/example",
          skillMdFound: true,
        })),
        skillsWriteSkill: vi.fn(async () => ({ success: true })),
      },
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn(async () => undefined) },
      configurable: true,
    });
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
    vi.spyOn(window, "prompt").mockImplementation(() => "");
  });

  it("imports from GitHub through an in-app dialog instead of window.prompt", async () => {
    render(<SkillsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "创建技能" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /从 Github 导入/ }));
    fireEvent.change(screen.getByLabelText("GitHub 仓库 URL"), {
      target: { value: "https://github.com/user/repo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "导入" }));

    await waitFor(() => {
      expect(window.piAPI.skillsGithubImport).toHaveBeenCalledWith("https://github.com/user/repo");
    });
    expect(window.prompt).not.toHaveBeenCalled();
    expect(await screen.findByText(/导入成功/)).toBeTruthy();
  });

  it("shows invalid skill names inline instead of window.alert", async () => {
    render(<SkillsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "创建技能" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /编写技能/ }));
    fireEvent.click(screen.getByRole("button", { name: "保存 SKILL.md" }));

    expect(screen.getByRole("alert").textContent).toContain("请输入有效的技能名称");
    expect(window.alert).not.toHaveBeenCalled();
    expect(window.piAPI.skillsWriteSkill).not.toHaveBeenCalled();
  });

  it("shows both save and clipboard fallback failures when writing a skill fails", async () => {
    window.piAPI!.skillsWriteSkill = vi.fn(async () => {
      throw new Error("disk denied");
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValueOnce(new Error("clipboard denied")) },
      configurable: true,
    });

    render(<SkillsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "创建技能" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /编写技能/ }));
    fireEvent.change(screen.getByPlaceholderText("my-skill"), { target: { value: "copy-fail" } });
    fireEvent.click(screen.getByRole("button", { name: "保存 SKILL.md" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("保存失败，且无法复制到剪贴板");
    expect(alert.textContent).toContain("保存错误: disk denied");
    expect(alert.textContent).toContain("复制错误: clipboard denied");
  });
});

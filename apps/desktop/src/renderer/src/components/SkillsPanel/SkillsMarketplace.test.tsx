// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSkillsStore } from "../../stores/skills-store";
import { SkillsMarketplace } from "./SkillsMarketplace";

describe("SkillsMarketplace", () => {
  beforeEach(() => {
    useSkillsStore.setState({
      skillhubAvailable: true,
      marketQuery: "web",
      marketResults: [
        {
          slug: "web-search",
          name: "web-search",
          description: "Search the web",
          version: "1.0.0",
          source: "community",
        },
      ],
      marketLoading: false,
      installed: [],
      installedLoading: false,
      error: null,
    });
    Object.defineProperty(window, "piAPI", {
      value: {
        skillsCheck: vi.fn(async () => true),
        skillsInstall: vi.fn(async () => undefined),
        skillsInstalled: vi.fn(async () => []),
        skillsSearch: vi.fn(async () => []),
      },
      configurable: true,
    });
  });

  it("shows install failures from SkillHub packages", async () => {
    window.piAPI!.skillsInstall = vi.fn(async () => {
      throw new Error("install failed");
    });

    render(<SkillsMarketplace />);

    fireEvent.click(await screen.findByRole("button", { name: "安装 web-search" }));

    expect((await screen.findByRole("alert")).textContent).toContain("install failed");
  });
});

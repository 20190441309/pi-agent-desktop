import { beforeEach, describe, expect, it, vi } from "vitest";

const addToast = vi.fn();

vi.mock("../toast-store", () => ({
  addToast,
}));

describe("skills-store", () => {
  beforeEach(() => {
    vi.resetModules();
    addToast.mockReset();
    vi.unstubAllGlobals();
  });

  async function load() {
    return import("../skills-store");
  }

  it("checkAvailability stores boolean from IPC", async () => {
    vi.stubGlobal("window", {
      piAPI: { skillsCheck: vi.fn(async () => true) },
    });
    const { useSkillsStore } = await load();
    useSkillsStore.setState({ skillhubAvailable: null });
    await useSkillsStore.getState().checkAvailability();
    expect(useSkillsStore.getState().skillhubAvailable).toBe(true);
  });

  it("checkAvailability falls back to false on failure", async () => {
    vi.stubGlobal("window", {
      piAPI: {
        skillsCheck: vi.fn(async () => {
          throw new Error("no skillhub");
        }),
      },
    });
    const { useSkillsStore } = await load();
    await useSkillsStore.getState().checkAvailability();
    expect(useSkillsStore.getState().skillhubAvailable).toBe(false);
  });

  it("searchMarket clears results for empty query", async () => {
    const skillsSearch = vi.fn();
    vi.stubGlobal("window", { piAPI: { skillsSearch } });
    const { useSkillsStore } = await load();
    useSkillsStore.setState({
      marketQuery: "   ",
      marketResults: [
        {
          slug: "x",
          name: "X",
          description: "",
          version: "0.0.1",
        },
      ],
    });
    await useSkillsStore.getState().searchMarket();
    expect(skillsSearch).not.toHaveBeenCalled();
    expect(useSkillsStore.getState().marketResults).toEqual([]);
  });

  it("searchMarket stores results and clears loading", async () => {
    vi.stubGlobal("window", {
      piAPI: {
        skillsSearch: vi.fn(async () => [
          {
            slug: "demo",
            name: "Demo",
            description: "d",
            version: "1.0.0",
          },
        ]),
      },
    });
    const { useSkillsStore } = await load();
    useSkillsStore.setState({ marketQuery: "demo" });
    await useSkillsStore.getState().searchMarket();
    expect(useSkillsStore.getState().marketResults[0]?.slug).toBe("demo");
    expect(useSkillsStore.getState().marketLoading).toBe(false);
  });

  it("searchMarket records error on failure", async () => {
    vi.stubGlobal("window", {
      piAPI: {
        skillsSearch: vi.fn(async () => {
          throw new Error("network down");
        }),
      },
    });
    const { useSkillsStore } = await load();
    useSkillsStore.setState({ marketQuery: "x" });
    await useSkillsStore.getState().searchMarket();
    expect(useSkillsStore.getState().error).toBe("network down");
    expect(useSkillsStore.getState().marketLoading).toBe(false);
  });

  it("installSkill refreshes installed list", async () => {
    const skillsInstall = vi.fn(async () => undefined);
    const skillsInstalled = vi.fn(async () => [{ slug: "demo", enabled: true }]);
    vi.stubGlobal("window", { piAPI: { skillsInstall, skillsInstalled } });
    const { useSkillsStore } = await load();
    await useSkillsStore.getState().installSkill("demo");
    expect(skillsInstall).toHaveBeenCalledWith("demo");
    expect(useSkillsStore.getState().installed).toEqual([{ slug: "demo", enabled: true }]);
  });

  it("uninstallSkill toasts on failure", async () => {
    vi.stubGlobal("window", {
      piAPI: {
        skillsUninstall: vi.fn(async () => {
          throw new Error("busy");
        }),
      },
    });
    const { useSkillsStore } = await load();
    await useSkillsStore.getState().uninstallSkill("demo");
    expect(useSkillsStore.getState().error).toBe("busy");
    expect(addToast).toHaveBeenCalledWith("卸载技能失败: busy", "error");
  });

  it("toggleSkill refreshes after IPC", async () => {
    const skillsToggle = vi.fn(async () => undefined);
    const skillsInstalled = vi.fn(async () => [{ slug: "demo", enabled: false }]);
    vi.stubGlobal("window", { piAPI: { skillsToggle, skillsInstalled } });
    const { useSkillsStore } = await load();
    await useSkillsStore.getState().toggleSkill("demo", false);
    expect(skillsToggle).toHaveBeenCalledWith("demo", false);
    expect(useSkillsStore.getState().installed[0]?.enabled).toBe(false);
  });
});

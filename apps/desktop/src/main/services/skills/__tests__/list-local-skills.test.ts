import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listLocalSkills } from "../list-local-skills";

describe("listLocalSkills", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "list-local-skills-"));
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(root, { recursive: true, force: true });
  });

  it("returns empty when .agents/skills is missing", async () => {
    await expect(listLocalSkills(root)).resolves.toEqual([]);
  });

  it("lists skill directories with first non-heading line as description", async () => {
    const skillDir = join(root, ".agents", "skills", "demo-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      "# Demo\n\nUseful demo skill for tests.\n\nMore body\n",
      "utf-8",
    );
    // file entry should be ignored
    writeFileSync(join(root, ".agents", "skills", "not-a-dir.txt"), "x", "utf-8");

    const skills = await listLocalSkills(root);
    expect(skills).toEqual([
      {
        name: "demo-skill",
        description: "Useful demo skill for tests.",
        path: skillDir,
        enabled: true,
      },
    ]);
  });

  it("caches results for 30s TTL then refreshes", async () => {
    const skillDir = join(root, ".agents", "skills", "cached");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "First desc\n", "utf-8");

    const first = await listLocalSkills(root);
    expect(first[0]?.description).toBe("First desc");

    writeFileSync(join(skillDir, "SKILL.md"), "Second desc\n", "utf-8");
    // within TTL → still first
    const cached = await listLocalSkills(root);
    expect(cached[0]?.description).toBe("First desc");

    vi.advanceTimersByTime(30_001);
    const refreshed = await listLocalSkills(root);
    expect(refreshed[0]?.description).toBe("Second desc");
  });

  it("tolerates missing SKILL.md with empty description", async () => {
    const skillDir = join(root, ".agents", "skills", "bare");
    mkdirSync(skillDir, { recursive: true });
    const skills = await listLocalSkills(root);
    expect(skills).toEqual([
      {
        name: "bare",
        description: "",
        path: skillDir,
        enabled: true,
      },
    ]);
  });
});

import { mkdir, mkdtemp, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertWorkspacePathAllowed,
  readLinkTarget,
  resolveCanonicalTarget,
} from "../path-canonical";

const temps: string[] = [];

async function makeTempWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pi-path-canonical-"));
  temps.push(dir);
  return dir;
}

afterEach(async () => {
  while (temps.length > 0) {
    const dir = temps.pop();
    if (!dir) continue;
    await rm(dir, { recursive: true, force: true });
  }
});

describe("resolveCanonicalTarget", () => {
  it("returns realpath for an existing file", async () => {
    const ws = await makeTempWorkspace();
    const file = join(ws, "note.txt");
    await writeFile(file, "hi", "utf8");
    await expect(resolveCanonicalTarget(file)).resolves.toBe(await import("fs/promises").then((m) => m.realpath(file)));
  });

  it("resolves missing leaf under an existing ancestor", async () => {
    const ws = await makeTempWorkspace();
    const nested = join(ws, "src", "new-file.ts");
    await mkdir(join(ws, "src"), { recursive: true });
    const resolved = await resolveCanonicalTarget(nested);
    expect(resolved.replaceAll("\\", "/")).toMatch(/src\/new-file\.ts$/);
  });
});

describe("readLinkTarget", () => {
  it("returns undefined for ordinary files", async () => {
    const ws = await makeTempWorkspace();
    const file = join(ws, "plain.txt");
    await writeFile(file, "x", "utf8");
    await expect(readLinkTarget(file)).resolves.toBeUndefined();
  });

  it("returns absolute target for a symbolic link when supported", async () => {
    const ws = await makeTempWorkspace();
    const target = join(ws, "target.txt");
    const link = join(ws, "alias.txt");
    await writeFile(target, "data", "utf8");
    try {
      await symlink(target, link);
    } catch {
      // Windows without Developer Mode / privilege may refuse symlink creation.
      return;
    }
    const resolved = await readLinkTarget(link);
    expect(resolved).toBeDefined();
    expect(resolved?.replaceAll("\\", "/").toLowerCase()).toContain("target.txt");
  });
});

describe("assertWorkspacePathAllowed", () => {
  it("allows ordinary files inside the workspace", async () => {
    const ws = await makeTempWorkspace();
    const file = join(ws, "src", "app.ts");
    await mkdir(join(ws, "src"), { recursive: true });
    await writeFile(file, "export {}", "utf8");
    const result = await assertWorkspacePathAllowed(file, ws);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.canonicalPath.replaceAll("\\", "/")).toMatch(/src\/app\.ts$/i);
    }
  });

  it("rejects paths outside the workspace", async () => {
    const ws = await makeTempWorkspace();
    const outside = join(tmpdir(), "pi-outside-secret.txt");
    temps.push(outside);
    await writeFile(outside, "secret", "utf8");
    const result = await assertWorkspacePathAllowed(outside, ws);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/不在当前工作区|敏感|Home/);
    }
  });

  it("rejects sensitive files even inside the workspace", async () => {
    const ws = await makeTempWorkspace();
    const envFile = join(ws, ".env");
    await writeFile(envFile, "KEY=1", "utf8");
    const result = await assertWorkspacePathAllowed(envFile, ws);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("敏感");
    }
  });

  it("rejects when workspace path cannot be resolved", async () => {
    const missingWs = join(tmpdir(), `pi-missing-ws-${Date.now()}`);
    const result = await assertWorkspacePathAllowed(join(missingWs, "a.ts"), missingWs);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/无法解析工作区路径|不在当前工作区/);
    }
  });
});

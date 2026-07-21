import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, describe, expect, it } from "vitest";
import { loadPiSdk, resetPiSdkForTests, resolvePiSdkEntry } from "../sdk-runtime";

describe("sdk-runtime", () => {
  const roots: string[] = [];

  afterEach(() => {
    resetPiSdkForTests();
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  function makeTree(depthLabel: string): { baseDir: string; entry: string } {
    const root = join(tmpdir(), `pi-sdk-runtime-${depthLabel}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    // resolvePiSdkEntry walks up from baseDir with ../../../../, ../../../, ../../
    // Put baseDir at root/a/b/c so ../../../../ = root
    const baseDir = join(root, "a", "b", "c", "d");
    mkdirSync(baseDir, { recursive: true });
    const entry = join(
      root,
      "node_modules",
      "@earendil-works",
      "pi-coding-agent",
      "dist",
      "index.js",
    );
    mkdirSync(join(entry, ".."), { recursive: true });
    writeFileSync(entry, "export const __piSdkTestMarker = true;\n", "utf8");
    return { baseDir, entry };
  }

  it("resolvePiSdkEntry finds the nearest existing package entry", () => {
    const { baseDir, entry } = makeTree("found");
    expect(resolvePiSdkEntry(baseDir)).toBe(entry);
  });

  it("resolvePiSdkEntry returns undefined when no candidate exists", () => {
    const root = join(tmpdir(), `pi-sdk-runtime-missing-${Date.now()}`);
    roots.push(root);
    const baseDir = join(root, "x", "y");
    mkdirSync(baseDir, { recursive: true });
    expect(resolvePiSdkEntry(baseDir)).toBeUndefined();
  });

  it("loadPiSdk throws a clear error when the runtime entry is missing", async () => {
    const root = join(tmpdir(), `pi-sdk-runtime-throw-${Date.now()}`);
    roots.push(root);
    const baseDir = join(root, "x", "y");
    mkdirSync(baseDir, { recursive: true });
    await expect(loadPiSdk(baseDir)).rejects.toThrow(/Pi SDK runtime entry not found/);
  });

  it("loadPiSdk caches the resolved module until resetPiSdkForTests", async () => {
    const { baseDir } = makeTree("reuse");
    const firstMod = await loadPiSdk(baseDir);
    expect(firstMod).toBeTruthy();
    // Second resolve should return the same module instance (cached promise).
    const secondMod = await loadPiSdk(baseDir);
    expect(secondMod).toBe(firstMod);
    // reset clears the cache so a subsequent call can re-resolve
    resetPiSdkForTests();
    const thirdMod = await loadPiSdk(baseDir);
    expect(thirdMod).toBeTruthy();
  });
});

import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, openSync, readSync, closeSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function sha256Head(filePath: string, headBytes = 1_048_576): string {
  const st = statSync(filePath);
  const len = Math.min(st.size, headBytes);
  const buf = Buffer.alloc(len);
  const fd = openSync(filePath, "r");
  try {
    readSync(fd, buf, 0, len, 0);
  } finally {
    closeSync(fd);
  }
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * K-004 / K-014 / K-015 honesty gate:
 * - Confirms release NSIS artifacts exist on disk (package build evidence).
 * - Validates latest.yml points at a present setup.exe with matching size.
 * - Does NOT install, upgrade, or reboot — that requires an isolated VM/sandbox
 *   and would mutate the host. Status remains BLOCKED for install/upgrade execution.
 *
 * Isolation runbook: docs/testing/nsis-isolation-runbook.md
 */
test.describe("NSIS artifact inventory (no install)", () => {
  test("release setup.exe artifacts exist for historical package evidence (K-014 inventory)", () => {
    const distDir = join(__dirname, "..", "dist");
    expect(existsSync(distDir)).toBe(true);

    const entries = readdirSync(distDir);
    const setups = entries.filter((name) => /^Pi-Desktop-.*-setup\.exe$/i.test(name));
    expect(setups.length).toBeGreaterThan(0);

    const inventory = setups.map((name) => {
      const full = join(distDir, name);
      const st = statSync(full);
      // First 1 MiB hash + size: cheap integrity fingerprint (full-file hash is slow on ~150MB).
      return {
        name,
        bytes: st.size,
        mtimeMs: st.mtimeMs,
        headSha256: sha256Head(full),
      };
    });

    for (const item of inventory) {
      expect(item.bytes).toBeGreaterThan(10_000_000);
      expect(item.headSha256).toMatch(/^[a-f0-9]{64}$/);
    }

    // Prefer multi-version matrix when present (upgrade path evidence of artifacts only).
    const versions = setups
      .map((name) => name.match(/Pi-Desktop-(\d+\.\d+\.\d+)-setup\.exe/i)?.[1])
      .filter((v): v is string => Boolean(v));
    expect(versions.length).toBeGreaterThan(0);

    const latestYmlPath = join(distDir, "latest.yml");
    expect(existsSync(latestYmlPath)).toBe(true);
    const latestYml = readFileSync(latestYmlPath, "utf8");
    const versionMatch = latestYml.match(/^\s*version:\s*['"]?([0-9.]+)/m);
    const pathMatch = latestYml.match(/^\s*(?:path|url):\s*['"]?([^\s'"]+)/m);
    expect(versionMatch?.[1]).toBeTruthy();
    const latestSetupName =
      pathMatch?.[1] ?? `Pi-Desktop-${versionMatch![1]}-setup.exe`;
    expect(setups).toContain(latestSetupName);

    const latestItem = inventory.find((item) => item.name === latestSetupName);
    expect(latestItem).toBeTruthy();
    const sizeMatch = latestYml.match(/^\s*size:\s*(\d+)/m);
    if (sizeMatch) {
      expect(latestItem!.bytes).toBe(Number(sizeMatch[1]));
    }

    // win-unpacked product version is build evidence, not an NSIS install proof.
    const unpackedExe = join(distDir, "win-unpacked", "Pi Desktop.exe");
    if (existsSync(unpackedExe)) {
      const unpackedStat = statSync(unpackedExe);
      expect(unpackedStat.size).toBeGreaterThan(1_000_000);
    }

    console.log(
      `[TEST] NSIS inventory (no install executed): ${JSON.stringify({ inventory, versions, latestSetupName })}`,
    );
    test.info().annotations.push({
      type: "note",
      description:
        "K-004/K-014/K-015 remain BLOCKED for install/uninstall/upgrade isolation; this test only inventories artifacts. See docs/testing/nsis-isolation-runbook.md.",
    });
  });
});

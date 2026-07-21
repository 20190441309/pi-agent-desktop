import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * K-004 / K-014 / K-015 honesty gate (wave-12):
 * - Proves isolation readiness scripts exist and host safety refuse works.
 * - Does NOT install/uninstall/upgrade — those require Windows Sandbox / admin VM.
 * - Status remains BLOCKED until Sandbox evidence (summary.json with PASS) is produced.
 *
 * See: docs/testing/nsis-isolation-runbook.md, docs/testing/PiDesktop-NSIS.wsb
 */
const repoRoot = join(__dirname, "..", "..", "..");
const desktopRoot = join(__dirname, "..");
const distDir = join(desktopRoot, "dist");
const probeScript = join(repoRoot, "scripts", "nsis-isolation-probe.ps1");
const smokeScript = join(repoRoot, "scripts", "nsis-sandbox-smoke.ps1");
const wsbConfig = join(repoRoot, "docs", "testing", "PiDesktop-NSIS.wsb");
const runbook = join(repoRoot, "docs", "testing", "nsis-isolation-runbook.md");

function runPowerShell(scriptPath: string, args: string[] = []): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 60_000,
    },
  );
  return {
    status: result.status,
    stdout: `${result.stdout ?? ""}${result.error ? String(result.error) : ""}`,
    stderr: result.stderr ?? "",
  };
}

test.describe("NSIS isolation honesty gate (no install)", () => {
  test("ready-pack artifacts exist (probe, smoke, wsb, runbook, dist setups)", () => {
    expect(existsSync(probeScript), "nsis-isolation-probe.ps1").toBe(true);
    expect(existsSync(smokeScript), "nsis-sandbox-smoke.ps1").toBe(true);
    expect(existsSync(wsbConfig), "PiDesktop-NSIS.wsb").toBe(true);
    expect(existsSync(runbook), "nsis-isolation-runbook.md").toBe(true);
    expect(existsSync(distDir), "apps/desktop/dist").toBe(true);

    const setups = readdirSync(distDir).filter((name) =>
      /^Pi-Desktop-.*-setup\.exe$/i.test(name),
    );
    expect(setups.length).toBeGreaterThan(0);
    expect(setups.some((name) => /1\.0\.13/i.test(name))).toBe(true);

    const wsb = readFileSync(wsbConfig, "utf8");
    expect(wsb).toContain("nsis-sandbox-smoke.ps1");
    expect(wsb).toContain("MappedFolder");

    const book = readFileSync(runbook, "utf8");
    expect(book).toMatch(/K-004|K-014|K-015/);
    expect(book).toMatch(/Windows Sandbox|BLOCKED/i);
  });

  test("isolation probe reports host constraints without installing", () => {
    const probe = runPowerShell(probeScript);
    // Probe is observational; exit 0 expected even when blocked.
    expect(probe.status).toBe(0);
    const text = `${probe.stdout}\n${probe.stderr}`;
    expect(text).toMatch(/admin=/i);
    expect(text).toMatch(/host_pi|decision=BLOCKED|forbid_host_setup_uninstall/i);
    // Never claim install executed.
    expect(text).not.toMatch(/k014_install=PASS|start setup/i);

    test.info().annotations.push({
      type: "note",
      description:
        "Probe only. K-004/K-014/K-015 stay BLOCKED until Sandbox/VM produces nsis-evidence summary PASS.",
    });
  });

  test("sandbox smoke refuses host production install (exit 2)", () => {
    const evidenceDir = test.info().outputPath(`nsis-refuse-${Date.now()}`);
    const smoke = runPowerShell(smokeScript, [
      "-DistDir",
      distDir,
      "-EvidenceDir",
      evidenceDir,
    ]);

    // Host with production Pi Desktop must not mutate.
    expect(smoke.status).toBe(2);
    const text = `${smoke.stdout}\n${smoke.stderr}`;
    expect(text).toMatch(/REFUSE|host_install_present|existing install/i);

    const refuseJson = join(evidenceDir, "REFUSED-host-install.json");
    expect(existsSync(refuseJson)).toBe(true);
    // PowerShell Set-Content -Encoding UTF8 may emit a UTF-8 BOM.
    const rawJson = readFileSync(refuseJson, "utf8").replace(/^\uFEFF/, "");
    const body = JSON.parse(rawJson) as {
      status?: string;
      reason?: string;
      version?: string;
    };
    expect(body.status).toBe("REFUSED");
    expect(body.reason).toBe("host_install_present");
    expect(body.version).toMatch(/1\.0\.\d+/);

    console.log(
      `[TEST] NSIS host refuse OK status=${smoke.status} version=${body.version} (K-004/014/015 still BLOCKED)`,
    );
    test.info().annotations.push({
      type: "note",
      description:
        "Host refuse verified. Install/uninstall/upgrade NOT executed. Matrix IDs remain BLOCKED.",
    });
  });
});

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { runChildAgent } from "../child-agent";

const originalPath = process.env.PATH;

afterEach(() => {
    process.env.PATH = originalPath;
});

function createFakePi(mode: "brainstorm" | "implement" = "brainstorm"): string {
    const dir = mkdtempSync(join(tmpdir(), "compose-child-agent-"));
    writeFileSync(join(dir, "pi.cmd"), "@echo off\r\nnode \"%~dp0fake-pi.js\" %*\r\n", "utf8");
    writeFileSync(join(dir, "fake-pi.js"), mode === "brainstorm" ? `
let stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  stdin += chunk;
});
process.stdin.on("end", () => {
  if (!stdin.includes("Brainstorm phase")) {
    console.error("unexpected prompt:" + JSON.stringify(stdin));
    process.exit(1);
  }
  console.log("BRAINSTORM_OK");
});
` : `
let stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  stdin += chunk;
});
process.stdin.on("end", () => {
  if (!stdin.includes("Implement phase") || !stdin.includes("Task ID: task-1")) {
    console.error("missing multiline prompt:" + JSON.stringify(stdin));
    process.exit(1);
  }
  console.log("IMPLEMENT_STDIN_OK");
});
`, "utf8");
    return dir;
}

describe("runChildAgent", () => {
    it("launches pi.cmd on Windows without spawn EINVAL", async () => {
        if (process.platform !== "win32") {
            expect(true).toBe(true);
            return;
        }

        const fakePiDir = createFakePi("brainstorm");
        try {
            process.env.PATH = `${fakePiDir};${originalPath ?? ""}`;

            const result = await runChildAgent({
                label: "Brainstorm",
                cwd: fakePiDir,
                prompt: "Brainstorm phase\nContext: reproduce Windows compose runtime child agent launch.",
                timeoutMs: 5_000,
            });

            expect(result.ok).toBe(true);
            expect(result.stdout).toContain("BRAINSTORM_OK");
        } finally {
            rmSync(fakePiDir, { recursive: true, force: true });
        }
    });

    it("delivers the full multi-line prompt body to the child agent on Windows", async () => {
        if (process.platform !== "win32") {
            expect(true).toBe(true);
            return;
        }

        const fakePiDir = createFakePi("implement");
        try {
            process.env.PATH = `${fakePiDir};${originalPath ?? ""}`;

            const result = await runChildAgent({
                label: "Implement task-1",
                cwd: fakePiDir,
                prompt: [
                    "You are the Implement phase of Pi Desktop Compose runtime.",
                    "Task ID: task-1",
                    "Task Description: Create compose_probe_one.txt with WORKTREE_ONE_OK.",
                ].join("\n"),
                timeoutMs: 5_000,
            });

            expect(result.ok).toBe(true);
            expect(result.stdout).toContain("IMPLEMENT_STDIN_OK");
        } finally {
            rmSync(fakePiDir, { recursive: true, force: true });
        }
    });
});

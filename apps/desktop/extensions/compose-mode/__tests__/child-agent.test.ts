import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { runChildAgent } from "../child-agent";

const originalPath = process.env.PATH;
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const originalSourceAgentDir = process.env.PI_DESKTOP_TEST_SOURCE_AGENT_DIR;

afterEach(() => {
    process.env.PATH = originalPath;
    process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    process.env.PI_DESKTOP_TEST_SOURCE_AGENT_DIR = originalSourceAgentDir;
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

function createFakePiExpectingTempAgentDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "compose-child-agent-"));
    writeFileSync(join(dir, "pi.cmd"), "@echo off\r\nnode \"%~dp0fake-pi.js\" %*\r\n", "utf8");
    writeFileSync(join(dir, "fake-pi.js"), `
const fs = require("fs");
const path = require("path");

const agentDir = process.env.PI_CODING_AGENT_DIR;
const sourceAgentDir = process.env.PI_DESKTOP_TEST_SOURCE_AGENT_DIR;
if (!agentDir) {
  console.error("missing PI_CODING_AGENT_DIR");
  process.exit(1);
}
if (agentDir === sourceAgentDir) {
  console.error("child agent reused source agent dir");
  process.exit(1);
}
const models = JSON.parse(fs.readFileSync(path.join(agentDir, "models.json"), "utf8"));
if (models.providers.openai_ispure.apiKey !== "sk-test-real") {
  console.error("missing injected provider apiKey");
  process.exit(1);
}
console.log("TEMP_AGENT_DIR_OK");
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

    it("injects auth.json keys into a temporary child agent dir for custom providers on Windows", async () => {
        if (process.platform !== "win32") {
            expect(true).toBe(true);
            return;
        }

        const fakePiDir = createFakePiExpectingTempAgentDir();
        const sourceAgentDir = mkdtempSync(join(tmpdir(), "compose-source-agent-"));
        try {
            process.env.PATH = `${fakePiDir};${originalPath ?? ""}`;
            process.env.PI_CODING_AGENT_DIR = sourceAgentDir;
            process.env.PI_DESKTOP_TEST_SOURCE_AGENT_DIR = sourceAgentDir;
            writeFileSync(join(sourceAgentDir, "models.json"), JSON.stringify({
                providers: {
                    openai_ispure: {
                        name: "OpenAI (ispure)",
                        baseUrl: "https://example.invalid/v1",
                        api: "openai-completions",
                        models: [{ id: "gpt-5.5", name: "GPT 5.5" }],
                    },
                },
            }), "utf8");
            writeFileSync(join(sourceAgentDir, "auth.json"), JSON.stringify({
                openai_ispure: { key: "sk-test-real" },
            }), "utf8");
            writeFileSync(join(sourceAgentDir, "settings.json"), "{}", "utf8");

            const result = await runChildAgent({
                label: "Brainstorm",
                cwd: fakePiDir,
                prompt: "Brainstorm phase",
                provider: "openai_ispure",
                modelId: "gpt-5.5",
                timeoutMs: 5_000,
            });

            expect(result.ok).toBe(true);
            expect(result.stdout).toContain("TEMP_AGENT_DIR_OK");
        } finally {
            rmSync(fakePiDir, { recursive: true, force: true });
            rmSync(sourceAgentDir, { recursive: true, force: true });
        }
    });
});

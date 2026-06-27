import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ChildAgentRunInput, ChildAgentRunResult } from "./types.ts";

function piCommand(): string {
    return process.platform === "win32" ? "pi.cmd" : "pi";
}

function windowsNpmBinPath(): string {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "npm");
}

function findCommandOnPath(commandName: string): string | undefined {
    const pathValue = process.env.PATH ?? process.env.Path ?? "";
    const entries = pathValue.split(";").map((entry) => entry.trim()).filter(Boolean);
    for (const entry of entries) {
        const candidate = join(entry, commandName);
        if (existsSync(candidate)) return candidate;
    }
    return undefined;
}

function resolveWindowsPiShim(): string | undefined {
    return findCommandOnPath("pi.cmd") ?? (() => {
        const candidate = join(windowsNpmBinPath(), "pi.cmd");
        return existsSync(candidate) ? candidate : undefined;
    })();
}

function resolveWindowsPiCliJs(piShim?: string): string | undefined {
    if (piShim) {
        const localCandidate = join(dirname(piShim), "node_modules", "@earendil-works", "pi-coding-agent", "dist", "cli.js");
        return existsSync(localCandidate) ? localCandidate : undefined;
    }

    const globalCandidate = join(
        windowsNpmBinPath(),
        "node_modules",
        "@earendil-works",
        "pi-coding-agent",
        "dist",
        "cli.js",
    );
    return existsSync(globalCandidate) ? globalCandidate : undefined;
}

function childAgentCommand(input: ChildAgentRunInput): {
    command: string;
    args: string[];
    windowsVerbatimArguments?: boolean;
    stdinText: string;
} {
    const baseArgs = ["-p", "--no-session"];
    if (input.provider?.trim()) {
        baseArgs.push("--provider", input.provider.trim());
    }
    if (input.modelId?.trim()) {
        baseArgs.push("--model", input.modelId.trim());
    }

    if (process.platform === "win32") {
        const piShim = resolveWindowsPiShim();
        const cliJs = resolveWindowsPiCliJs(piShim);
        if (cliJs) {
            return {
                command: "node",
                args: [cliJs, ...baseArgs],
                stdinText: input.prompt,
            };
        }

        return {
            command: process.env.ComSpec?.trim() || "cmd.exe",
            args: ["/d", "/s", "/c", piShim ?? piCommand(), ...baseArgs],
            stdinText: input.prompt,
        };
    }

    return {
        command: piCommand(),
        args: baseArgs,
        stdinText: input.prompt,
    };
}

export async function runChildAgent(input: ChildAgentRunInput): Promise<ChildAgentRunResult> {
    const startedAt = Date.now();
    const { command, args, windowsVerbatimArguments, stdinText } = childAgentCommand(input);

    return new Promise<ChildAgentRunResult>((resolve) => {
        let stdout = "";
        let stderr = "";
        let finished = false;
        let timeoutId: NodeJS.Timeout | undefined;

        const finish = (exitCode: number | null) => {
            if (finished) return;
            finished = true;
            if (timeoutId) clearTimeout(timeoutId);
            const text = stdout.trim() || stderr.trim();
            resolve({
                ok: exitCode === 0,
                label: input.label,
                cwd: input.cwd,
                stdout,
                stderr,
                exitCode,
                durationMs: Date.now() - startedAt,
                text,
            });
        };

        let child;
        try {
            child = spawn(command, args, {
                cwd: input.cwd,
                shell: false,
                env: process.env,
                windowsVerbatimArguments,
            });
        } catch (error) {
            stderr += `${error instanceof Error ? error.message : String(error)}\n`;
            finish(1);
            return;
        }

        child.stdin?.on("error", (error) => {
            stderr += `${error instanceof Error ? error.message : String(error)}\n`;
        });
        child.stdout.on("data", (chunk: Buffer | string) => {
            const text = chunk.toString();
            stdout += text;
            for (const line of text.split(/\r?\n/).filter(Boolean)) {
                input.onStdoutLine?.(line);
            }
        });
        child.stderr.on("data", (chunk: Buffer | string) => {
            stderr += chunk.toString();
        });
        child.on("error", (error) => {
            stderr += `${error instanceof Error ? error.message : String(error)}\n`;
            finish(1);
        });
        child.on("close", (exitCode) => finish(exitCode));
        child.stdin?.end(stdinText);

        const abort = () => {
            if (!finished) child.kill();
        };
        input.signal?.addEventListener("abort", abort, { once: true });

        if (input.timeoutMs && input.timeoutMs > 0) {
            timeoutId = setTimeout(() => {
                stderr += `Timed out after ${input.timeoutMs}ms\n`;
                abort();
            }, input.timeoutMs);
        }
    });
}

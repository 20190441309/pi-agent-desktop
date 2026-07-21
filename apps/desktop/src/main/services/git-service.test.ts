import { beforeEach, describe, expect, it, vi } from "vitest";
import { isIpcError } from "@shared";

const { mockResults, execFileMock } = vi.hoisted(() => {
    // Queue of fake execFile results. Each entry is either a stdout string
    // (success) or an Error (rejects the execGit promise). Tests push results
    // in call order; the mock shifts one off per invocation.
    const mockResults: Array<string | Error> = [];
    const execFileMock = vi.fn((...args: any[]) => {
        const callback = args[args.length - 1];
        const mockResult = mockResults.shift() ?? "";
        if (typeof callback !== "function") return;
        if (mockResult instanceof Error) {
            callback(mockResult, "");
        } else {
            callback(null, mockResult);
        }
    });
    return { mockResults, execFileMock };
});

vi.mock("child_process", () => ({
    execFile: execFileMock,
}));

import { gitAdd, gitCheckout, gitCommit, gitDiff, gitDiffStaged, gitPush, getGitStatus, gitUnstage } from "./git-service";

describe("git-service protected path policy", () => {
    beforeEach(() => {
        execFileMock.mockClear();
        mockResults.length = 0;
    });

    it("normalizes ordinary file paths before staging", async () => {
        const result = await gitAdd("C:/repo", ["src\\app.ts"]);

        expect(result).toBeUndefined();
        expect(execFileMock).toHaveBeenCalledWith(
            "git",
            ["add", "--", "src/app.ts"],
            expect.objectContaining({ cwd: "C:/repo" }),
            expect.any(Function),
        );
    });

    it("blocks staging files outside the workspace", async () => {
        const outsidePath = process.platform === "win32" ? "C:/outside/readme.txt" : "/tmp/outside/readme.txt";
        const result = await gitAdd("C:/repo", [outsidePath]);

        expect(isIpcError(result)).toBe(true);
        if (isIpcError(result)) {
            expect(result.code).toBe("ipcErrors.git.protectedPath");
            expect(result.fallback).toContain("不在当前工作区");
        }
        expect(execFileMock).not.toHaveBeenCalled();
    });

    it("blocks staging sensitive files inside the workspace", async () => {
        const result = await gitAdd("C:/repo", [".env.local"]);

        expect(isIpcError(result)).toBe(true);
        if (isIpcError(result)) {
            expect(result.code).toBe("ipcErrors.git.protectedPath");
            expect(result.fallback).toContain("敏感配置");
        }
        expect(execFileMock).not.toHaveBeenCalled();
    });

    it("blocks git operations when the workspace root itself is protected", async () => {
        const result = await gitCommit("C:/Users/demo/.ssh", "commit secrets");

        expect(isIpcError(result)).toBe(true);
        if (isIpcError(result)) {
            expect(result.code).toBe("ipcErrors.git.protectedPath");
            expect(result.fallback).toContain("敏感凭据目录");
        }
        expect(execFileMock).not.toHaveBeenCalled();
    });

    it("pushes through a parameterized non-blocking git command", async () => {
        mockResults.push("Everything up-to-date\n");

        const result = await gitPush("C:/repo");

        expect(result).toContain("Everything up-to-date");
        expect(execFileMock).toHaveBeenCalledWith(
            "git",
            ["push"],
            expect.objectContaining({ cwd: "C:/repo", timeout: 60_000 }),
            expect.any(Function),
        );
    });

    it("validates and checks out a local branch as a branch, not a path", async () => {
        mockResults.push("feature/right-rail\n", "abc123\n", "Switched to branch 'feature/right-rail'\n");

        const result = await gitCheckout("C:/repo", "feature/right-rail");

        expect(result).toBeUndefined();
        expect(execFileMock).toHaveBeenNthCalledWith(
            1,
            "git",
            ["check-ref-format", "--branch", "feature/right-rail"],
            expect.objectContaining({ cwd: "C:/repo" }),
            expect.any(Function),
        );
        expect(execFileMock).toHaveBeenNthCalledWith(
            2,
            "git",
            ["rev-parse", "--verify", "refs/heads/feature/right-rail^{commit}"],
            expect.objectContaining({ cwd: "C:/repo" }),
            expect.any(Function),
        );
        expect(execFileMock).toHaveBeenNthCalledWith(
            3,
            "git",
            ["checkout", "feature/right-rail"],
            expect.objectContaining({ cwd: "C:/repo" }),
            expect.any(Function),
        );
    });
    it("applies the same file guard to diff and unstage", async () => {
        const outsidePath = process.platform === "win32" ? "C:/outside/app.ts" : "/tmp/outside/app.ts";
        const diffResult = await gitDiff("C:/repo", outsidePath);
        const unstageResult = await gitUnstage("C:/repo", [".npmrc"]);

        expect(isIpcError(diffResult)).toBe(true);
        expect(isIpcError(unstageResult)).toBe(true);
        expect(execFileMock).not.toHaveBeenCalled();
    });

    it("uses parameterized git commands for status and staged diff", async () => {
        mockResults.push(
            "C:/repo\n", // findGitRoot: rev-parse --show-toplevel
            "main\n", // rev-parse --abbrev-ref HEAD
            " M src/app.ts\n?? src/new.ts\n", // status --porcelain
            "origin/main\n", // rev-parse --abbrev-ref @{u}
            "2\t1\n", // rev-list --left-right --count HEAD...origin/main
            "diff --git a/src/app.ts b/src/app.ts\n", // gitDiffStaged: diff --staged
        );

        const status = await getGitStatus("C:/repo");
        const staged = await gitDiffStaged("C:/repo");

        expect(status).toMatchObject({
            branch: "main",
            modified: ["src/app.ts"],
            untracked: ["src/new.ts"],
            ahead: 2,
            behind: 1,
        });
        expect(staged).toContain("diff --git");
        expect(execFileMock).toHaveBeenCalledWith(
            "git",
            ["status", "--porcelain"],
            expect.objectContaining({ cwd: "C:/repo" }),
            expect.any(Function),
        );
        expect(execFileMock).toHaveBeenCalledWith(
            "git",
            ["diff", "--staged"],
            expect.objectContaining({ cwd: "C:/repo" }),
            expect.any(Function),
        );
    });

    it("keeps staged-only changes out of unstaged status buckets", async () => {
        mockResults.push(
            "C:/repo\n", // findGitRoot
            "main\n", // branch
            "M  src/staged-only.ts\nMM src/staged-and-unstaged.ts\nA  src/staged-new.ts\n D src/deleted-worktree.ts\n?? src/untracked.ts\n", // status --porcelain
            new Error("no upstream"), // rev-parse --abbrev-ref @{u} rejects
        );

        const status = await getGitStatus("C:/repo");

        expect(status).toMatchObject({
            branch: "main",
            modified: ["src/staged-and-unstaged.ts"],
            added: [],
            deleted: ["src/deleted-worktree.ts"],
            untracked: ["src/untracked.ts"],
            ahead: 0,
            behind: 0,
        });
    });
});

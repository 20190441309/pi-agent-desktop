import { execFileSync } from "child_process";
import { isAbsolute, relative, resolve } from "path";
import { ipcError, type GitStatus, type IpcError } from "@shared";
import { getProtectedPathReason } from "./protected-paths";

export function protectedGitPathError(path: string, reason: string): IpcError {
    return ipcError("ipcErrors.git.protectedPath", reason, { path });
}

function assertWorkspaceAllowed(workspacePath: string): IpcError | null {
    const reason = getProtectedPathReason(workspacePath);
    return reason ? protectedGitPathError(workspacePath, reason) : null;
}

function toGitPath(workspacePath: string, filePath: string): string | IpcError {
    const workspaceRoot = resolve(workspacePath);
    const targetPath = isAbsolute(filePath) ? resolve(filePath) : resolve(workspaceRoot, filePath);
    const reason = getProtectedPathReason(targetPath, workspaceRoot);
    if (reason) return protectedGitPathError(targetPath, reason);
    return relative(workspaceRoot, targetPath).replace(/\\/g, "/");
}

function normalizeGitPaths(workspacePath: string, files: string[]): string[] | IpcError {
    const normalized: string[] = [];
    for (const file of files) {
        const next = toGitPath(workspacePath, file);
        if (typeof next !== "string") return next;
        normalized.push(next);
    }
    return normalized;
}

function findGitRoot(workspacePath: string): string | null {
    try {
        return execFileSync("git", ["rev-parse", "--show-toplevel"], {
            cwd: workspacePath,
            encoding: "utf-8",
        }).trim();
    } catch {
        return null;
    }
}

export function getGitStatus(workspacePath: string): GitStatus | null | IpcError {
    const workspaceError = assertWorkspaceAllowed(workspacePath);
    if (workspaceError) return workspaceError;

    const gitRoot = findGitRoot(workspacePath);
    if (!gitRoot) return null;

    let branch = "main";
    try {
        branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
            cwd: gitRoot,
            encoding: "utf-8",
        }).trim();
    } catch {
        // Detached head or unusual repository state; keep the UI usable.
    }

    const statusOutput = execFileSync("git", ["status", "--porcelain"], {
        cwd: gitRoot,
        encoding: "utf-8",
    });
    const modified: string[] = [];
    const added: string[] = [];
    const deleted: string[] = [];
    const untracked: string[] = [];

    for (const line of statusOutput.split("\n").filter((item) => item.trim())) {
        const status = line.substring(0, 2);
        const file = line.substring(3).trim();
        if (status.includes("M")) modified.push(file);
        if (status.includes("A")) added.push(file);
        if (status.includes("D")) deleted.push(file);
        if (status.includes("?")) untracked.push(file);
    }

    let ahead = 0;
    let behind = 0;
    try {
        const upstream = execFileSync("git", ["rev-parse", "--abbrev-ref", "@{u}"], {
            cwd: gitRoot,
            encoding: "utf-8",
        }).trim();
        const countOutput = execFileSync("git", ["rev-list", "--left-right", "--count", `HEAD...${upstream}`], {
            cwd: gitRoot,
            encoding: "utf-8",
        }).trim();
        const parts = countOutput.split("\t");
        if (parts.length === 2) {
            ahead = parseInt(parts[0], 10) || 0;
            behind = parseInt(parts[1], 10) || 0;
        }
    } catch {
        // No upstream configured.
    }

    return { branch, modified, added, deleted, untracked, ahead, behind };
}

export function gitDiff(workspacePath: string, filePath?: string): string | IpcError {
    const workspaceError = assertWorkspaceAllowed(workspacePath);
    if (workspaceError) return workspaceError;
    if (!filePath) {
        return execFileSync("git", ["diff"], {
            cwd: workspacePath,
            encoding: "utf-8",
            maxBuffer: 10 * 1024 * 1024,
        });
    }
    const gitPath = toGitPath(workspacePath, filePath);
    if (typeof gitPath !== "string") return gitPath;
    return execFileSync("git", ["diff", "--", gitPath], {
        cwd: workspacePath,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
    });
}

export function gitDiffStaged(workspacePath: string): string | IpcError {
    const workspaceError = assertWorkspaceAllowed(workspacePath);
    if (workspaceError) return workspaceError;
    return execFileSync("git", ["diff", "--staged"], {
        cwd: workspacePath,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
    });
}

export function gitAdd(workspacePath: string, files: string[]): void | IpcError {
    const workspaceError = assertWorkspaceAllowed(workspacePath);
    if (workspaceError) return workspaceError;
    if (files.length === 0) return undefined;
    const gitPaths = normalizeGitPaths(workspacePath, files);
    if (!Array.isArray(gitPaths)) return gitPaths;
    execFileSync("git", ["add", "--", ...gitPaths], { cwd: workspacePath });
    return undefined;
}

export function gitUnstage(workspacePath: string, files: string[]): void | IpcError {
    const workspaceError = assertWorkspaceAllowed(workspacePath);
    if (workspaceError) return workspaceError;
    if (files.length === 0) return undefined;
    const gitPaths = normalizeGitPaths(workspacePath, files);
    if (!Array.isArray(gitPaths)) return gitPaths;
    execFileSync("git", ["restore", "--staged", "--", ...gitPaths], { cwd: workspacePath });
    return undefined;
}

export function gitCommit(workspacePath: string, message: string): string | IpcError {
    const workspaceError = assertWorkspaceAllowed(workspacePath);
    if (workspaceError) return workspaceError;
    return execFileSync("git", ["commit", "-m", message], {
        cwd: workspacePath,
        encoding: "utf-8",
    });
}

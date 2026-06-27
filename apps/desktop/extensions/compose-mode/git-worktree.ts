import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

export interface WorktreeSupportResult {
    supported: boolean;
    reason?: string;
    gitRoot?: string;
    currentBranch?: string;
    headSha?: string;
    clean?: boolean;
}

export interface ComposeWorktree {
    gitRoot: string;
    worktreePath: string;
    branchName: string;
    baseHead: string;
}

export interface ComposeWorktreeBase {
    gitRoot: string;
    headSha: string;
}

export interface WorktreePatchResult {
    changed: boolean;
    patch?: string;
    summary: string;
    changedFiles: string[];
}

export interface ApplyWorktreePatchResult {
    applied: boolean;
    summary: string;
}

export interface CommitWorkspaceResult {
    committed: boolean;
    sha?: string;
    summary: string;
}

interface GitResult {
    ok: boolean;
    stdout: string;
    stderr: string;
    message?: string;
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 32)
        .replace(/-+$/g, "") || "compose";
}

function worktreeBucket(gitRoot: string): string {
    const repoSlug = slugify(basename(gitRoot)).slice(0, 18) || "repo";
    const repoHash = createHash("sha1").update(gitRoot).digest("hex").slice(0, 12);
    const bucket = join(tmpdir(), "pi-desktop-compose-worktrees", `${repoSlug}-${repoHash}`);
    mkdirSync(bucket, { recursive: true });
    return bucket;
}

function runGit(args: string[], cwd: string, input?: string): GitResult {
    try {
        const stdout = execFileSync("git", args, {
            cwd,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
            input,
        });
        return {
            ok: true,
            stdout: stdout.trim(),
            stderr: "",
        };
    } catch (error) {
        const failure = error as {
            stdout?: string | Buffer;
            stderr?: string | Buffer;
            message?: string;
        };
        return {
            ok: false,
            stdout: failure.stdout?.toString().trim() ?? "",
            stderr: failure.stderr?.toString().trim() ?? "",
            message: failure.message ?? String(error),
        };
    }
}

function gitError(result: GitResult, fallback: string): Error {
    return new Error(result.stderr || result.stdout || result.message || fallback);
}

function gitRootOf(cwd: string): string | null {
    const result = runGit(["rev-parse", "--show-toplevel"], cwd);
    return result.ok ? result.stdout : null;
}

function listChangedFiles(cwd: string): string[] {
    const result = runGit(["status", "--porcelain"], cwd);
    if (!result.ok) throw gitError(result, "Failed to read git status");
    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.slice(3).trim())
        .filter(Boolean);
}

export function detectGitWorktreeSupport(cwd: string): WorktreeSupportResult {
    const gitRoot = gitRootOf(cwd);
    if (!gitRoot) {
        return {
            supported: false,
            reason: "Current workspace is not inside a git repository.",
        };
    }

    const worktreeList = runGit(["worktree", "list"], gitRoot);
    if (!worktreeList.ok) {
        return {
            supported: false,
            gitRoot,
            reason: worktreeList.stderr || worktreeList.message || "Git worktree support is unavailable.",
        };
    }

    const branch = runGit(["branch", "--show-current"], gitRoot);
    const head = runGit(["rev-parse", "HEAD"], gitRoot);
    const changedFiles = listChangedFiles(gitRoot);
    if (changedFiles.length > 0) {
        return {
            supported: false,
            gitRoot,
            currentBranch: branch.ok ? branch.stdout : undefined,
            headSha: head.ok ? head.stdout : undefined,
            clean: false,
            reason: "Git repository has uncommitted changes; compose worktree isolation needs a clean base.",
        };
    }

    return {
        supported: true,
        gitRoot,
        currentBranch: branch.ok ? branch.stdout : undefined,
        headSha: head.ok ? head.stdout : undefined,
        clean: true,
    };
}

export function createComposeWorktree(
    cwd: string,
    runId: string,
    taskLabel: string,
    base?: ComposeWorktreeBase,
): ComposeWorktree {
    const support = base ?? (() => {
        const detected = detectGitWorktreeSupport(cwd);
        if (!detected.supported || !detected.gitRoot || !detected.headSha) {
            throw new Error(detected.reason || "Git worktree support is unavailable.");
        }
        return {
            gitRoot: detected.gitRoot,
            headSha: detected.headSha,
        };
    })();

    const taskSlug = slugify(taskLabel);
    const runSlug = slugify(runId);
    const branchName = `compose-${runSlug.slice(0, 8)}-${taskSlug.slice(0, 12)}-${Date.now().toString(36)}`;
    const bucket = worktreeBucket(support.gitRoot);
    const worktreePrefix = `wt-${runSlug.slice(0, 8)}-${taskSlug.slice(0, 12)}-`;
    const worktreePath = mkdtempSync(join(bucket, worktreePrefix));
    const created = runGit(["worktree", "add", "-b", branchName, worktreePath, support.headSha], support.gitRoot);
    if (!created.ok) {
        rmSync(worktreePath, { recursive: true, force: true });
        throw gitError(created, "Failed to create compose worktree");
    }

    return {
        gitRoot: support.gitRoot,
        worktreePath,
        branchName,
        baseHead: support.headSha,
    };
}

export function captureComposeWorktreePatch(worktreePath: string): WorktreePatchResult {
    const staged = runGit(["add", "-A"], worktreePath);
    if (!staged.ok) {
        throw gitError(staged, "Failed to stage worktree changes");
    }

    const changedFiles = runGit(["diff", "--cached", "--name-only", "HEAD"], worktreePath);
    if (!changedFiles.ok) {
        throw gitError(changedFiles, "Failed to inspect staged worktree changes");
    }

    const files = changedFiles.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (files.length === 0) {
        return {
            changed: false,
            summary: "no workspace changes",
            changedFiles: [],
        };
    }

    const patch = runGit(["diff", "--cached", "--binary", "HEAD"], worktreePath);
    if (!patch.ok) {
        throw gitError(patch, "Failed to capture worktree patch");
    }

    const stat = runGit(["diff", "--cached", "--stat", "HEAD"], worktreePath);
    const summary = stat.ok && stat.stdout
        ? stat.stdout.replace(/\s+/g, " ").trim()
        : `captured patch for ${files.length} file(s)`;

    return {
        changed: true,
        patch: patch.stdout,
        summary,
        changedFiles: files,
    };
}

export function applyComposeWorktreePatch(gitRoot: string, patch: string, label = "compose patch"): ApplyWorktreePatchResult {
    if (!patch.trim()) {
        return {
            applied: false,
            summary: `${label}: empty patch`,
        };
    }

    const bucket = worktreeBucket(gitRoot);
    const patchPath = join(bucket, `apply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.patch`);
    writeFileSync(patchPath, `${patch.trim()}\n`, "utf8");
    try {
        const applied = runGit(["apply", "--3way", "--whitespace=nowarn", patchPath], gitRoot);
        if (!applied.ok) {
            throw gitError(applied, "Failed to apply compose worktree patch");
        }
        return {
            applied: true,
            summary: `${label}: patch applied`,
        };
    } finally {
        try {
            unlinkSync(patchPath);
        } catch {
            // best-effort cleanup
        }
    }
}

export function removeComposeWorktree(worktree: ComposeWorktree): void {
    const removed = runGit(["worktree", "remove", "--force", worktree.worktreePath], worktree.gitRoot);
    if (!removed.ok && existsSync(worktree.worktreePath)) {
        rmSync(worktree.worktreePath, { recursive: true, force: true });
    }
    if (existsSync(worktree.worktreePath)) {
        throw gitError(removed, "Failed to remove compose worktree directory");
    }

    const deleted = runGit(["branch", "-D", worktree.branchName], worktree.gitRoot);
    if (!deleted.ok && !/not found|not exist/i.test(`${deleted.stderr}\n${deleted.stdout}`)) {
        throw gitError(deleted, "Failed to delete compose worktree branch");
    }
}

export function workspaceHasGitChanges(cwd: string): boolean {
    const gitRoot = gitRootOf(cwd);
    if (!gitRoot) return false;
    return listChangedFiles(gitRoot).length > 0;
}

export function commitComposeWorkspace(cwd: string, message: string): CommitWorkspaceResult {
    const gitRoot = gitRootOf(cwd);
    if (!gitRoot) {
        return {
            committed: false,
            summary: "Git repository is unavailable; commit skipped.",
        };
    }

    const staged = runGit(["add", "-A"], gitRoot);
    if (!staged.ok) {
        throw gitError(staged, "Failed to stage compose workspace changes");
    }

    const changedFiles = runGit(["diff", "--cached", "--name-only", "HEAD"], gitRoot);
    if (!changedFiles.ok) {
        throw gitError(changedFiles, "Failed to inspect staged compose workspace changes");
    }

    const files = changedFiles.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (files.length === 0) {
        return {
            committed: false,
            summary: "No git changes remained to commit.",
        };
    }

    const committed = runGit(["commit", "-m", message], gitRoot);
    if (!committed.ok) {
        throw gitError(committed, "Failed to create compose workflow commit");
    }

    const sha = runGit(["rev-parse", "HEAD"], gitRoot);
    return {
        committed: true,
        sha: sha.ok ? sha.stdout : undefined,
        summary: `Committed ${files.length} file(s).`,
    };
}

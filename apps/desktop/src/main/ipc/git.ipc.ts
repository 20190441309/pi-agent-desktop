import { ipcMain } from 'electron';
import { execFileSync } from 'child_process';
import log from 'electron-log/main';
import { ipcError } from '@shared';
import { gitAdd, gitCommit, gitDiff, gitDiffStaged, getGitStatus, gitUnstage } from '../services/git-service';
import { getProtectedPathReason } from '../services/protected-paths';
import { gitAddSchema, gitCommitSchema, gitDiffSchema, gitDiffStagedSchema } from './schemas';

export function setupGitIpc(): void {
  ipcMain.handle('git:status', async (_, workspacePath: string) => {
    try {
      return getGitStatus(workspacePath);
    } catch (err) {
      log.error("[git.ipc] git:status failed:", err);
      return ipcError(
        "ipcErrors.git.statusFailed",
        `读取 git 状态失败: ${err instanceof Error ? err.message : String(err)}`,
        { path: workspacePath },
      );
    }
  });

  ipcMain.handle('git:diff', async (_, workspacePath: string, filePath?: string) => {
    try {
      gitDiffSchema.parse(filePath === undefined ? [workspacePath] : [workspacePath, filePath]);
    } catch (err) {
      log.warn("[git.ipc] git:diff invalid args:", err);
      return ipcError(
        "ipcErrors.git.invalidArgs",
        `git diff 参数无效: ${err instanceof Error ? err.message : String(err)}`,
        { path: String(filePath ?? "") },
      );
    }
    try {
      return gitDiff(workspacePath, filePath);
    } catch (err) {
      log.error("[git.ipc] git:diff failed:", err);
      return ipcError(
        "ipcErrors.git.diffFailed",
        `读取 git diff 失败: ${err instanceof Error ? err.message : String(err)}`,
        { path: filePath ?? "all" },
      );
    }
  });

  ipcMain.handle('git:diff-staged', async (_, workspacePath: string) => {
    try {
      gitDiffStagedSchema.parse([workspacePath]);
    } catch (err) {
      log.warn("[git.ipc] git:diff-staged invalid args:", err);
      return ipcError(
        "ipcErrors.git.invalidArgs",
        `git staged diff 参数无效: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    try {
      // gitDiffStaged delegates to git with the standard ['diff', '--staged'] argv.
      return gitDiffStaged(workspacePath);
    } catch (err) {
      log.error("[git.ipc] git:diff-staged failed:", err);
      return ipcError(
        "ipcErrors.git.diffFailed",
        `读取 staged diff 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('git:add', async (_, workspacePath: string, files: string[]) => {
    try {
      gitAddSchema.parse([workspacePath, files]);
    } catch (err) {
      log.warn("[git.ipc] git:add invalid args:", err);
      return ipcError(
        "ipcErrors.git.invalidArgs",
        `git add 参数无效: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (files.length === 0) return;
    try {
      return gitAdd(workspacePath, files);
    } catch (err) {
      log.error("[git.ipc] git:add exec failed:", err);
      return ipcError(
        "ipcErrors.git.addFailed",
        `git add 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('git:unstage', async (_, workspacePath: string, files: string[]) => {
    try {
      gitAddSchema.parse([workspacePath, files]);
    } catch (err) {
      log.warn("[git.ipc] git:unstage invalid args:", err);
      return ipcError(
        "ipcErrors.git.invalidArgs",
        `git unstage 参数无效: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (files.length === 0) return undefined;
    try {
      return gitUnstage(workspacePath, files);
    } catch (err) {
      log.error("[git.ipc] git:unstage exec failed:", err);
      return ipcError(
        "ipcErrors.git.unstageFailed",
        `git unstage 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('git:commit', async (_, workspacePath: string, message: string) => {
    try {
      gitCommitSchema.parse([workspacePath, message]);
    } catch (err) {
      log.warn("[git.ipc] git:commit invalid args:", err);
      return ipcError(
        "ipcErrors.git.invalidArgs",
        `git commit 参数无效: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    try {
      return gitCommit(workspacePath, message);
    } catch (err) {
      log.error("[git.ipc] git:commit exec failed:", err);
      return ipcError(
        "ipcErrors.git.commitFailed",
        `git commit 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('git:log', async (_, workspacePath: string, count: number = 20) => {
    const logPathReason = getProtectedPathReason(workspacePath);
    if (logPathReason) {
      return ipcError("ipcErrors.git.protectedPath", logPathReason, { path: workspacePath });
    }
    try {
      const format = '--pretty=format:{"hash":"%h","author":"%an","date":"%ai","message":"%s"}';
      const output = execFileSync('git', ['log', format, '-n', String(count)], { cwd: workspacePath, encoding: 'utf-8' });
      return output.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
    } catch (err) {
      log.error("[git.ipc] git:log failed:", err);
      return ipcError(
        "ipcErrors.git.logFailed",
        `读取 git log 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  ipcMain.handle('git:branches', async (_, workspacePath: string) => {
    const branchPathReason = getProtectedPathReason(workspacePath);
    if (branchPathReason) {
      return ipcError("ipcErrors.git.protectedPath", branchPathReason, { path: workspacePath });
    }
    try {
      const output = execFileSync('git', ['branch', '-a'], { cwd: workspacePath, encoding: 'utf-8' });
      return output.split('\n').filter(l => l.trim()).map(l => ({
        name: l.replace(/^\*?\s+/, '').trim(),
        isCurrent: l.startsWith('*'),
        isRemote: l.includes('remotes/')
      }));
    } catch (err) {
      log.error("[git.ipc] git:branches failed:", err);
      return ipcError(
        "ipcErrors.git.branchesFailed",
        `读取 git branches 失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });
}

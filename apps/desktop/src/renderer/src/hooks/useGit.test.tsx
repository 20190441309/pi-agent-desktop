// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGit } from "./useGit";

const getGitStatus = vi.fn();
const gitBranches = vi.fn();
const gitLog = vi.fn();
const gitAdd = vi.fn();
const gitDiff = vi.fn();
const gitDiffStaged = vi.fn();
const gitCommit = vi.fn();
const gitUndo = vi.fn();

function GitHookHost(): React.JSX.Element {
  const git = useGit("C:/repo");
  const [error, setError] = React.useState("");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void git.stageFiles(["src/a.ts"]).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : String(err));
          });
        }}
      >
        stage
      </button>
      <button
        type="button"
        onClick={() => {
          void git.loadDiff("src/a.ts").catch((err: unknown) => {
            setError(err instanceof Error ? err.message : String(err));
          });
        }}
      >
        diff
      </button>
      <button
        type="button"
        onClick={() => {
          void git.commit("update").catch((err: unknown) => {
            setError(err instanceof Error ? err.message : String(err));
          });
        }}
      >
        commit
      </button>
      <button
        type="button"
        onClick={() => {
          void git.undo("src/a.ts").catch((err: unknown) => {
            setError(err instanceof Error ? err.message : String(err));
          });
        }}
      >
        undo
      </button>
      <button
        type="button"
        onClick={() => {
          void git.refresh().catch((err: unknown) => {
            setError(err instanceof Error ? err.message : String(err));
          });
        }}
      >
        refresh
      </button>
      <div data-testid="error">{error}</div>
      <div data-testid="hook-error">{git.error ?? ""}</div>
    </div>
  );
}

describe("useGit", () => {
  beforeEach(() => {
    getGitStatus.mockReset();
    gitBranches.mockReset();
    gitLog.mockReset();
    gitAdd.mockReset();
    gitDiff.mockReset();
    gitDiffStaged.mockReset();
    gitCommit.mockReset();
    gitUndo.mockReset();
    getGitStatus.mockResolvedValue({
      branch: "main",
      modified: [],
      added: [],
      deleted: [],
      untracked: [],
      ahead: 0,
      behind: 0,
    });
    gitBranches.mockResolvedValue([]);
    gitLog.mockResolvedValue([]);
    gitDiff.mockResolvedValue("");
    gitDiffStaged.mockResolvedValue("");
    gitCommit.mockResolvedValue("ok");
    gitUndo.mockResolvedValue(undefined);
    Object.defineProperty(window, "piAPI", {
      value: {
        getGitStatus,
        gitBranches,
        gitLog,
        gitAdd,
        gitDiff,
        gitDiffStaged,
        gitCommit,
        gitUndo,
      },
      configurable: true,
    });
  });

  it("throws the IPC fallback when git add returns an IpcError", async () => {
    gitAdd.mockResolvedValueOnce({
      code: "ipcErrors.git.addFailed",
      fallback: "git add 失败: permission denied",
    });

    render(<GitHookHost />);

    fireEvent.click(screen.getByRole("button", { name: "stage" }));

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toContain("git add 失败: permission denied");
    });
    expect(gitAdd).toHaveBeenCalledWith("C:/repo", ["src/a.ts"]);
  });

  it("throws the IPC fallback when git diff returns an IpcError", async () => {
    gitDiff.mockResolvedValueOnce({
      code: "ipcErrors.git.diffFailed",
      fallback: "读取 git diff 失败: not a git repo",
    });

    render(<GitHookHost />);

    fireEvent.click(screen.getByRole("button", { name: "diff" }));

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toContain("读取 git diff 失败: not a git repo");
    });
    expect(gitDiff).toHaveBeenCalledWith("C:/repo", "src/a.ts");
  });

  it("throws the IPC fallback when git commit returns an IpcError", async () => {
    gitCommit.mockResolvedValueOnce({
      code: "ipcErrors.git.commitFailed",
      fallback: "git commit 失败: nothing to commit",
    });

    render(<GitHookHost />);

    fireEvent.click(screen.getByRole("button", { name: "commit" }));

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toContain("git commit 失败: nothing to commit");
    });
    expect(gitCommit).toHaveBeenCalledWith("C:/repo", "update");
  });

  it("stores the IPC fallback when git status refresh fails", async () => {
    getGitStatus.mockResolvedValue({
      code: "ipcErrors.git.statusFailed",
      fallback: "读取 git 状态失败: not a git repo",
    });

    render(<GitHookHost />);

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("hook-error").textContent).toContain("读取 git 状态失败: not a git repo");
    });
  });

  it("throws the IPC fallback when git undo returns an IpcError", async () => {
    gitUndo.mockResolvedValueOnce({
      code: "ipcErrors.chat.gitUndoFailed",
      fallback: "撤销文件改动失败: permission denied",
    });

    render(<GitHookHost />);

    fireEvent.click(screen.getByRole("button", { name: "undo" }));

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toContain("撤销文件改动失败: permission denied");
    });
    expect(gitUndo).toHaveBeenCalledWith("C:/repo", "src/a.ts");
  });
});

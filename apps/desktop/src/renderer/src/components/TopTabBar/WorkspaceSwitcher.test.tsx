// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { useSessionStore } from "../../stores/session-store";
import { useWorkspaceStore } from "../../stores/workspace-store";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

describe("WorkspaceSwitcher", () => {
  const createWorkspace = vi.fn(async (name: string, path: string) => {
    const workspace = {
      id: `ws_${name}`,
      name,
      path,
      createdAt: new Date(0),
      lastActiveAt: new Date(0),
    };
    useWorkspaceStore.setState((state) => ({
      workspaces: [...state.workspaces, workspace],
      currentWorkspaceId: workspace.id,
    }));
    return workspace;
  });

  const createEmptyWorkspace = vi.fn(async (name: string, parentPath: string) => {
    const workspace = {
      id: `ws_empty_${name}`,
      name,
      path: `${parentPath}\\${name}`,
      createdAt: new Date(0),
      lastActiveAt: new Date(0),
    };
    useWorkspaceStore.setState((state) => ({
      workspaces: [...state.workspaces, workspace],
      currentWorkspaceId: workspace.id,
    }));
    return workspace;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "piAPI", {
      value: {
        selectWorkspace: vi.fn(async () => undefined),
        selectDirectory: vi.fn(async () => "C:\\Ai\\NewProject"),
      },
      configurable: true,
    });
    vi.spyOn(window, "prompt").mockReturnValue("BlankProject");
    useWorkspaceStore.setState({
      workspaces: [
        {
          id: "ws_pi",
          name: "pi-desktop",
          path: "C:\\Ai\\pi-desktop",
          createdAt: new Date(0),
          lastActiveAt: new Date(0),
        },
        {
          id: "ws_hermes",
          name: "HermesCoWork",
          path: "C:\\Ai\\HermesCoWork",
          createdAt: new Date(0),
          lastActiveAt: new Date(0),
        },
      ],
      currentWorkspaceId: "ws_pi",
      createWorkspace,
      createEmptyWorkspace,
      lastError: null,
    });
    useSessionStore.setState({
      sessions: [
        {
          id: "s_active",
          title: "Active Session",
          workspaceId: "ws_pi",
          createdAt: new Date(0),
          updatedAt: new Date(0),
          messages: [],
        },
      ],
      currentSessionId: "s_active",
    });
  });

  it("searches and switches existing workspaces", async () => {
    render(
      <I18nProvider>
        <WorkspaceSwitcher variant="strip" />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /切换工作区/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索项目" }), {
      target: { value: "Hermes" },
    });
    expect(screen.queryByRole("menuitem", { name: /pi-desktop/ })).toBeNull();

    fireEvent.click(screen.getByRole("menuitem", { name: /HermesCoWork/ }));

    await waitFor(() => {
      expect(useWorkspaceStore.getState().currentWorkspaceId).toBe("ws_hermes");
    });
    expect(window.piAPI.selectWorkspace).toHaveBeenCalledWith("C:\\Ai\\HermesCoWork");
  });

  it("creates a workspace from an existing folder", async () => {
    render(
      <I18nProvider>
        <WorkspaceSwitcher variant="strip" />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /切换工作区/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "使用现有文件夹" }));

    await waitFor(() => {
      expect(createWorkspace).toHaveBeenCalledWith("NewProject", "C:\\Ai\\NewProject");
    });
    expect(window.piAPI.selectWorkspace).toHaveBeenCalledWith("C:\\Ai\\NewProject");
  });

  it("creates an empty workspace from a selected parent directory", async () => {
    Object.defineProperty(window, "piAPI", {
      value: {
        selectWorkspace: vi.fn(async () => undefined),
        selectDirectory: vi.fn(async () => "C:\\Ai"),
      },
      configurable: true,
    });

    render(
      <I18nProvider>
        <WorkspaceSwitcher variant="strip" />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /切换工作区/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "新增空白项目" }));

    await waitFor(() => {
      expect(window.prompt).toHaveBeenCalled();
      expect(createEmptyWorkspace).toHaveBeenCalledWith("BlankProject", "C:\\Ai");
    });
    expect(window.piAPI.selectWorkspace).toHaveBeenCalledWith("C:\\Ai\\BlankProject");
  });

  it("clears the previously selected session before switching workspaces", async () => {
    render(
      <I18nProvider>
        <WorkspaceSwitcher variant="strip" />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /切换工作区/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /HermesCoWork/ }));

    await waitFor(() => {
      expect(useWorkspaceStore.getState().currentWorkspaceId).toBe("ws_hermes");
    });
    expect(useSessionStore.getState().currentSessionId).toBeNull();
  });
});

// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "../../stores/session-store";
import { useSettingsStore } from "../../stores/settings-store";
import { ToolPermissionsPanel } from "./ToolPermissionsPanel";

const developmentPermissions = {
  fileRead: true,
  fileWrite: true,
  shell: true,
  git: true,
  network: false,
  extensions: true,
};

describe("ToolPermissionsPanel", () => {
  beforeEach(() => {
    Object.defineProperty(window, "piAPI", {
      value: {
        setSettings: vi.fn(async () => undefined),
        updateSessionMetadata: vi.fn(async () => undefined),
      },
      configurable: true,
    });
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        workspaceToolDefaults: {},
      },
      lastWriteError: null,
    });
    useSessionStore.setState({
      sessions: [],
      currentSessionId: null,
      persistErrorCount: 0,
      lastPersistError: null,
    });
  });

  it("updates current session permissions and shows save feedback", () => {
    useSessionStore.setState({
      currentSessionId: "s1",
      sessions: [
        {
          id: "s1",
          workspaceId: "w1",
          title: "任务",
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
          toolPermissions: { ...developmentPermissions, shell: false },
        },
      ],
    });

    render(<ToolPermissionsPanel workspaceId="w1" />);

    fireEvent.click(screen.getByLabelText("Bash / PowerShell"));

    expect(useSessionStore.getState().sessions[0].toolPermissions?.shell).toBe(true);
    expect(window.piAPI.updateSessionMetadata).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        toolPermissions: expect.objectContaining({ shell: true }),
      }),
    );
    expect(screen.getByRole("status").textContent).toContain("已应用到当前会话");
  });

  it("updates workspace defaults and shows success feedback", async () => {
    render(<ToolPermissionsPanel workspaceId="w1" />);

    fireEvent.click(screen.getByRole("button", { name: "最小权限" }));

    expect(useSettingsStore.getState().settings.workspaceToolDefaults?.w1?.shell).toBe(false);
    expect(screen.getByRole("status").textContent).toContain("已更新工作区默认权限");
    await waitFor(() => {
      expect(window.piAPI.setSettings).toHaveBeenCalledWith({
        workspaceToolDefaults: expect.objectContaining({
          w1: expect.objectContaining({ shell: false }),
        }),
      });
    });
  });

  it("surfaces workspace permission write failures", async () => {
    window.piAPI.setSettings = vi.fn(async () => ({
      code: "ipcErrors.settings.writeFailed",
      fallback: "磁盘不可写",
    })) as unknown as Window["piAPI"]["setSettings"];

    render(<ToolPermissionsPanel workspaceId="w1" />);

    fireEvent.click(screen.getByRole("button", { name: "全部开启" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("工具权限保存失败：磁盘不可写");
    });
  });

  it("disables permission controls until a workspace or session is available", () => {
    render(<ToolPermissionsPanel />);

    expect(screen.getByRole("status").textContent).toContain("选择工作区后可配置默认工具权限");
    expect((screen.getByRole("button", { name: "最小权限" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("文件读取") as HTMLInputElement).disabled).toBe(true);
  });
});

// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { useAttachmentsStore } from "../../stores/attachments-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useWorkspaceStore } from "../../stores/workspace-store";
import { ChatInput } from "./ChatInput";

vi.mock("../../hooks/useMentions", () => ({
  useMentions: () => ({
    activeMention: null,
    candidates: [],
    highlightIndex: 0,
    setHighlightIndex: vi.fn(),
    selectCandidate: vi.fn(),
    close: vi.fn(),
  }),
}));

vi.mock("./PermissionRequestStack", () => ({
  PermissionRequestStack: () => null,
}));

describe("ChatInput", () => {
  beforeEach(() => {
    Object.defineProperty(window, "piAPI", {
      value: {},
      configurable: true,
    });
    useAttachmentsStore.setState({ byWorkspace: new Map() });
    useWorkspaceStore.setState({
      workspaces: [
        { id: "ws1", name: "repo", path: "C:/repo", createdAt: new Date(0), lastActiveAt: new Date(0) },
      ],
      currentWorkspaceId: "ws1",
    });
    useSettingsStore.setState({
      settings: {
        theme: "light",
        fontSize: 14,
        model: "",
        provider: "",
        temperature: 0.7,
        maxTokens: 4096,
        autoSave: true,
        showLineNumbers: true,
        wordWrap: true,
        permissionLevel: "smart",
      },
      piModels: null,
    });
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
  });

  it("shows attachment picker failures inline instead of window.alert", () => {
    render(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing={false}
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={vi.fn(async () => undefined)}
          onStop={vi.fn()}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加附件" }));

    expect(screen.getByRole("alert").textContent).toContain("文件选择不可用");
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("sends file attachments as Pi file references and clears them after send", async () => {
    const onSend = vi.fn(async () => undefined);
    Object.defineProperty(window, "piAPI", {
      value: {
        selectFiles: vi.fn(async () => ["C:/repo/src/app.ts"]),
      },
      configurable: true,
    });

    render(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing={false}
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={onSend}
          onStop={vi.fn()}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加附件" }));
    await screen.findByText("app.ts");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "检查这个文件" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith([
        "附加文件:",
        "@C:/repo/src/app.ts",
        "",
        "用户消息:",
        "检查这个文件",
      ].join("\n"));
    });
    await waitFor(() => {
      expect(useAttachmentsStore.getState().list("ws1")).toEqual([]);
    });
  });

  it("shows send failures without clearing the draft or attachments", async () => {
    const onSend = vi.fn(async () => {
      throw new Error("network down");
    });
    Object.defineProperty(window, "piAPI", {
      value: {
        selectFiles: vi.fn(async () => ["C:/repo/src/app.ts"]),
      },
      configurable: true,
    });

    render(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing={false}
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={onSend}
          onStop={vi.fn()}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加附件" }));
    await screen.findByText("app.ts");
    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textbox, { target: { value: "检查这个文件" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect((await screen.findByRole("alert")).textContent).toContain("发送失败: network down");
    expect(textbox.value).toBe("检查这个文件");
    expect(useAttachmentsStore.getState().list("ws1")).toHaveLength(1);
  });

  it("shows files:select IPC errors inline", async () => {
    Object.defineProperty(window, "piAPI", {
      value: {
        selectFiles: vi.fn(async () => ({
          code: "ipcErrors.files.selectFailed",
          fallback: "打开文件选择器失败: dialog unavailable",
        })),
      },
      configurable: true,
    });

    render(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing={false}
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={vi.fn(async () => undefined)}
          onStop={vi.fn()}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加附件" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("打开文件选择器失败: dialog unavailable");
    expect(useAttachmentsStore.getState().list("ws1")).toEqual([]);
  });

  it("shows rejected file picker errors inline", async () => {
    Object.defineProperty(window, "piAPI", {
      value: {
        selectFiles: vi.fn(async () => {
          throw new Error("dialog crashed");
        }),
      },
      configurable: true,
    });

    render(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing={false}
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={vi.fn(async () => undefined)}
          onStop={vi.fn()}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加附件" }));

    expect((await screen.findByRole("alert")).textContent).toContain("打开文件选择器失败: dialog crashed");
  });

  it("shows workspace switch errors inline without changing current workspace", async () => {
    useWorkspaceStore.setState({
      workspaces: [
        { id: "ws1", name: "repo", path: "C:/repo", createdAt: new Date(0), lastActiveAt: new Date(0) },
        { id: "ws2", name: "other", path: "C:/other", createdAt: new Date(1), lastActiveAt: new Date(1) },
      ],
      currentWorkspaceId: "ws1",
    });
    Object.defineProperty(window, "piAPI", {
      value: {
        selectWorkspace: vi.fn(async () => ({
          code: "ipcErrors.workspace.selectFailed",
          fallback: "切换 workspace 失败: not available",
        })),
      },
      configurable: true,
    });

    render(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing={false}
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={vi.fn(async () => undefined)}
          onStop={vi.fn()}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByTestId("chat-input-workspace-trigger"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /other/ }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("切换 workspace 失败: not available");
    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe("ws1");
  });

  it("shows new workspace picker IPC errors inline", async () => {
    Object.defineProperty(window, "piAPI", {
      value: {
        selectDirectory: vi.fn(async () => ({
          code: "ipcErrors.workspace.selectDirectoryFailed",
          fallback: "打开目录选择器失败: dialog unavailable",
        })),
      },
      configurable: true,
    });

    render(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing={false}
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={vi.fn(async () => undefined)}
          onStop={vi.fn()}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByTestId("chat-input-workspace-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: "选择新项目" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("打开目录选择器失败: dialog unavailable");
  });

  it("shows rejected new workspace picker errors inline", async () => {
    Object.defineProperty(window, "piAPI", {
      value: {
        selectDirectory: vi.fn(async () => {
          throw new Error("dialog crashed");
        }),
      },
      configurable: true,
    });

    render(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing={false}
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={vi.fn(async () => undefined)}
          onStop={vi.fn()}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByTestId("chat-input-workspace-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: "选择新项目" }));

    expect((await screen.findByRole("alert")).textContent).toContain("创建 workspace 失败: dialog crashed");
  });

  it("does not silently send unsupported image attachments", () => {
    const onSend = vi.fn(async () => undefined);
    useAttachmentsStore.getState().add("ws1", {
      id: "img1",
      kind: "image",
      name: "pasted.png",
      value: "data:image/png;base64,abc",
      mimeType: "image/png",
      size: 3,
    });

    render(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing={false}
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={onSend}
          onStop={vi.fn()}
        />
      </I18nProvider>,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "看图" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(screen.getByRole("alert").textContent).toContain("图片附件暂未接入");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("allows sending a follow-up instruction while a task is running", async () => {
    const onSend = vi.fn(async () => undefined);
    const onStop = vi.fn();

    render(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={onSend}
          onStop={onStop}
        />
      </I18nProvider>,
    );

    expect(screen.getByText(/任务运行中/).textContent).toContain("追加指令");
    const textbox = screen.getByRole("textbox");
    expect((textbox as HTMLTextAreaElement).disabled).toBe(false);

    fireEvent.change(textbox, { target: { value: "继续只提交 staged 文件" } });
    fireEvent.click(screen.getByRole("button", { name: "发送追加指令" }));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith("继续只提交 staged 文件"));
    expect(onStop).not.toHaveBeenCalled();
  });

  it("appends external prefill text without replacing the current draft", async () => {
    const onPrefillConsumed = vi.fn();
    const { rerender } = render(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing={false}
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={vi.fn(async () => undefined)}
          onStop={vi.fn()}
          prefill="@C:/repo/src/app.ts "
          prefillKey={1}
          onPrefillConsumed={onPrefillConsumed}
        />
      </I18nProvider>,
    );

    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textbox.value).toBe("@C:/repo/src/app.ts ");
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(textbox);
    });

    fireEvent.change(textbox, { target: { value: "请总结这个文件" } });
    rerender(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing={false}
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={vi.fn(async () => undefined)}
          onStop={vi.fn()}
          prefill="@C:/repo/src/app.ts "
          prefillKey={2}
          onPrefillConsumed={onPrefillConsumed}
        />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(textbox.value).toBe("请总结这个文件 @C:/repo/src/app.ts ");
    });

    rerender(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing={false}
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={vi.fn(async () => undefined)}
          onStop={vi.fn()}
          prefill="@C:/repo/src/app.ts "
          prefillKey={3}
          onPrefillConsumed={onPrefillConsumed}
        />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(textbox.value).toBe("请总结这个文件 @C:/repo/src/app.ts ");
    });
    expect(onPrefillConsumed).toHaveBeenCalledTimes(3);
  });

  it("keeps stop available as a separate action while running", () => {
    const onStop = vi.fn();

    render(
      <I18nProvider>
        <ChatInput
          isConnected
          isProcessing
          workspaceId="ws1"
          workspacePath="C:/repo"
          onSend={vi.fn(async () => undefined)}
          onStop={onStop}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "停止生成" }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

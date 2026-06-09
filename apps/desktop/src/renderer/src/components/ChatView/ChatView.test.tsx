// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { useSessionStore } from "../../stores/session-store";
import { useWorkspaceStore } from "../../stores/workspace-store";
import { usePiStatusStore } from "../../stores/pi-status-store";
import { ChatView } from "./ChatView";

const clearError = vi.fn();
const startStreaming = vi.fn(async () => undefined);
const stopStreaming = vi.fn();
let mockedStreamError: string | null = "上一轮错误";

vi.mock("../../hooks/usePiStream", () => ({
  usePiStream: () => ({
    isStreaming: false,
    isConnected: true,
    streamingMessageId: null,
    startStreaming,
    stopStreaming,
    clearError,
    error: mockedStreamError,
    currentThinking: "",
    currentText: "",
    toolCalls: new Map(),
  }),
}));

vi.mock("./ChatInput", () => ({
  ChatInput: ({ onSend }: { onSend: (message: string) => Promise<void> }) => (
    <div data-testid="chat-input-shell">
      <button type="button" data-testid="chat-input" onClick={() => void onSend("draft hello")}>
        send
      </button>
    </div>
  ),
}));

vi.mock("./MessageBubble", () => ({
  MessageBubble: ({
    message,
    onContinueFrom,
  }: {
    message: { id: string; content: string };
    onContinueFrom?: (messageId: string) => void;
  }) => (
    <div data-testid="message-bubble">
      {message.content}
      {onContinueFrom && (
        <button type="button" onClick={() => onContinueFrom(message.id)}>
          continue-from-message
        </button>
      )}
    </div>
  ),
}));

vi.mock("./PlanCard", () => ({
  PlanCardView: () => <div data-testid="plan-card" style={{ height: 900 }}>plan card</div>,
}));

describe("ChatView", () => {
  beforeEach(() => {
    clearError.mockClear();
    startStreaming.mockClear();
    stopStreaming.mockClear();
    mockedStreamError = "上一轮错误";
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollTo = vi.fn();
    Object.defineProperty(window, "piAPI", {
      value: {},
      configurable: true,
    });
    useWorkspaceStore.setState({
      workspaces: [
        {
          id: "ws1",
          name: "repo",
          path: "C:/ai/pi-agent-desktop",
          createdAt: new Date(0),
          lastActiveAt: new Date(0),
        },
      ],
      currentWorkspaceId: "ws1",
    });
    usePiStatusStore.setState({
      install: vi.fn(),
      isOperating: false,
      progress: null,
    });
    Object.defineProperty(window, "piAPI", {
      value: {
        createSession: vi.fn(async (workspaceId: string, title?: string, id?: string) => ({
          id: id ?? "s_created",
          title: title ?? "未命名会话",
          workspaceId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
        })),
        renameSession: vi.fn(async () => undefined),
      },
      configurable: true,
    });
    useSessionStore.setState({
      currentSessionId: "s1",
      sessions: [
        {
          id: "s1",
          title: "Session 1",
          workspaceId: "ws1",
          createdAt: new Date(0),
          updatedAt: new Date(0),
          messages: [
            {
              id: "u1",
              role: "user",
              content: "hello",
              timestamp: new Date(0),
            },
          ],
        },
        {
          id: "s2",
          title: "Session 2",
          workspaceId: "ws1",
          createdAt: new Date(0),
          updatedAt: new Date(0),
          messages: [],
        },
      ],
    });
  });

  it("clears stale stream errors when the active session changes", async () => {
    const { rerender } = render(
      <I18nProvider>
        <ChatView />
      </I18nProvider>,
    );

    await waitFor(() => expect(clearError).toHaveBeenCalled());
    const initialCalls = clearError.mock.calls.length;

    await act(async () => {
      useSessionStore.setState({ currentSessionId: "s2" });
      rerender(
        <I18nProvider>
          <ChatView />
        </I18nProvider>,
      );
    });

    await waitFor(() => {
      expect(clearError.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  it("renders the plan card after existing messages", () => {
    mockedStreamError = null;

    render(
      <I18nProvider>
        <ChatView />
      </I18nProvider>,
    );

    const message = screen.getByText("hello");
    const planCard = screen.getByTestId("plan-card");
    expect(message.compareDocumentPosition(planCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the input outside the scroll region and the message region as the only scroller", () => {
    mockedStreamError = null;
    useSessionStore.setState((state) => ({
      sessions: state.sessions.map((session) => (
        session.id === "s1"
          ? {
              ...session,
              messages: [
                ...session.messages,
                ...Array.from({ length: 20 }, (_, index) => ({
                  id: `a${index}`,
                  role: "assistant" as const,
                  content: `long assistant line ${index}\n${"body ".repeat(120)}`,
                  timestamp: new Date(index + 1),
                })),
              ],
            }
          : session
      )),
    }));

    render(
      <I18nProvider>
        <ChatView />
      </I18nProvider>,
    );

    const root = screen.getByTestId("chat-view-root");
    const scrollRegion = screen.getByTestId("chat-scroll-region");
    const inputShell = screen.getByTestId("chat-input-shell");
    const log = screen.getByRole("log");

    expect(root.className).toContain("overflow-hidden");
    expect(scrollRegion.className).toContain("flex-1");
    expect(scrollRegion.className).toContain("min-h-0");
    expect(scrollRegion.className).toContain("overflow-y-auto");
    expect(log.className).not.toContain("justify-end");
    expect(scrollRegion.contains(inputShell)).toBe(false);
    expect(root.lastElementChild?.contains(inputShell)).toBe(true);
  });

  it("auto-scrolls only the chat scroll region instead of the outer document", () => {
    mockedStreamError = null;
    const scrollIntoView = vi.fn();
    const scrollTo = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    window.HTMLElement.prototype.scrollTo = scrollTo;

    render(
      <I18nProvider>
        <ChatView />
      </I18nProvider>,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalled();
  });

  it("does not create a session just by opening an empty draft", async () => {
    useSessionStore.setState({ sessions: [], currentSessionId: null });

    render(
      <I18nProvider>
        <ChatView />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("chat-input")).toBeTruthy());
    expect(useSessionStore.getState().sessions).toHaveLength(0);
  });

  it("creates the draft session only when the first message is sent", async () => {
    useSessionStore.setState({ sessions: [], currentSessionId: null });

    render(
      <I18nProvider>
        <ChatView />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByTestId("chat-input"));

    await waitFor(() => {
      expect(useSessionStore.getState().sessions).toHaveLength(1);
    });
    expect(useSessionStore.getState().currentSessionId).toBeTruthy();
    await waitFor(() => expect(startStreaming).toHaveBeenCalledWith("ws1", "draft hello"));
  });

  it("shows an inline error when continuing a read-only session fails", async () => {
    mockedStreamError = null;
    useSessionStore.setState((state) => ({
      sessions: state.sessions.map((session) => (
        session.id === "s1" ? { ...session, readOnly: true } : session
      )),
    }));
    window.piAPI!.createSession = vi.fn(async () => ({
      code: "ipcErrors.sessions.createFailed",
      fallback: "创建会话失败: disk full",
    })) as unknown as Window["piAPI"]["createSession"];

    render(
      <I18nProvider>
        <ChatView />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "从此会话继续" }));

    expect((await screen.findByRole("alert")).textContent).toContain("继续会话失败: 创建会话失败: disk full");
    expect(useSessionStore.getState().currentSessionId).toBe("s1");
  });

  it("shows an inline error when continuing from a message fails", async () => {
    mockedStreamError = null;
    window.piAPI!.createSession = vi.fn(async () => ({
      code: "ipcErrors.sessions.createFailed",
      fallback: "创建会话失败: permission denied",
    })) as unknown as Window["piAPI"]["createSession"];

    render(
      <I18nProvider>
        <ChatView />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByText("continue-from-message"));

    expect((await screen.findByRole("alert")).textContent).toContain("创建会话分支失败: 创建会话失败: permission denied");
    expect(useSessionStore.getState().currentSessionId).toBe("s1");
  });
});

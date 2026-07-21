// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message, Session } from "../stores/session-store";

const storeCreateSession = vi.fn(async () => makeSession("new"));
const deleteSession = vi.fn();
const setCurrentSession = vi.fn();
const storeAddMessage = vi.fn();
const getCurrentSession = vi.fn(() => null as Session | null);

const sessionsRef: { current: Session[] } = { current: [] };
const currentSessionIdRef: { current: string | null } = { current: null };

vi.mock("../stores/session-store", () => ({
  useSessionStore: () => ({
    sessions: sessionsRef.current,
    currentSessionId: currentSessionIdRef.current,
    createSession: storeCreateSession,
    deleteSession,
    setCurrentSession,
    addMessage: storeAddMessage,
    getCurrentSession,
  }),
}));

vi.mock("../i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../utils/format", () => ({
  formatRelative: (date: Date) => `rel:${date.toISOString()}`,
}));

function makeMessage(partial: Partial<Message> & Pick<Message, "id" | "role" | "content">): Message {
  return {
    timestamp: Date.now(),
    ...partial,
  } as Message;
}

function makeSession(id: string, messages: Message[] = [], title = "Untitled"): Session {
  return {
    id,
    title,
    workspaceId: "ws-default",
    createdAt: new Date(),
    updatedAt: new Date(),
    messages,
  };
}

describe("useSession", () => {
  beforeEach(() => {
    sessionsRef.current = [];
    currentSessionIdRef.current = null;
    storeCreateSession.mockClear();
    deleteSession.mockClear();
    setCurrentSession.mockClear();
    storeAddMessage.mockClear();
    getCurrentSession.mockReset();
    getCurrentSession.mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  async function load() {
    return import("./useSession");
  }

  it("createSession delegates to store with default workspace", async () => {
    const { useSession } = await load();
    const { result } = renderHook(() => useSession());
    await act(async () => {
      await result.current.createSession();
    });
    expect(storeCreateSession).toHaveBeenCalledWith("default");
  });

  it("switchSession and addMessage proxy store actions", async () => {
    currentSessionIdRef.current = "s1";
    const { useSession } = await load();
    const { result } = renderHook(() => useSession());
    act(() => {
      result.current.switchSession("s2");
    });
    expect(setCurrentSession).toHaveBeenCalledWith("s2");

    const message = makeMessage({ id: "m1", role: "user", content: "hi" });
    act(() => {
      result.current.addMessage(message);
    });
    expect(storeAddMessage).toHaveBeenCalledWith("s1", message);
  });

  it("addMessage is a no-op without current session", async () => {
    currentSessionIdRef.current = null;
    const { useSession } = await load();
    const { result } = renderHook(() => useSession());
    act(() => {
      result.current.addMessage(makeMessage({ id: "m1", role: "user", content: "hi" }));
    });
    expect(storeAddMessage).not.toHaveBeenCalled();
  });

  it("getSessionTitle prefers first user message snippet", async () => {
    const { useSession } = await load();
    const { result } = renderHook(() => useSession());
    const long = "x".repeat(40);
    const session = makeSession(
      "s1",
      [
        makeMessage({ id: "a", role: "assistant", content: "bot" }),
        makeMessage({ id: "u", role: "user", content: long }),
      ],
      "fallback",
    );
    expect(result.current.getSessionTitle(session)).toBe(`${"x".repeat(30)}...`);
    expect(
      result.current.getSessionTitle(
        makeSession("s2", [makeMessage({ id: "u", role: "user", content: "short" })]),
      ),
    ).toBe("short");
    expect(result.current.getSessionTitle(makeSession("s3", [], "Only title"))).toBe("Only title");
  });

  it("formatTimestamp uses formatRelative", async () => {
    const { useSession } = await load();
    const { result } = renderHook(() => useSession());
    const date = new Date("2026-07-21T00:00:00.000Z");
    expect(result.current.formatTimestamp(date)).toBe("rel:2026-07-21T00:00:00.000Z");
  });
});

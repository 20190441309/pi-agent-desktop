import { describe, expect, it } from "vitest";
import type { Session } from "../stores/session-store";
import type { Workspace } from "../stores/workspace-store";
import {
  groupSessionsByWorkspace,
  sessionActivityTime,
  sessionDepth,
  sessionMatches,
} from "./session-grouping";

function session(partial: Partial<Session> & Pick<Session, "id" | "workspaceId">): Session {
  return {
    title: partial.id,
    messages: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...partial,
  } as Session;
}

describe("sessionMatches", () => {
  it("matches generated ui text when message content is empty", () => {
    const s = {
      id: "s1",
      title: "Generated UI session",
      workspaceId: "w1",
      createdAt: new Date(0),
      updatedAt: new Date(0),
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "",
          timestamp: new Date(0),
          generatedUi: {
            version: "v1",
            id: "ui-grouping",
            title: "交付结果",
            sections: [
              { id: "summary", kind: "summary", content: "已生成 docs/report.md" },
            ],
          },
        },
      ],
    } satisfies Session;

    expect(sessionMatches(s, "report.md")).toBe(true);
  });
});

describe("sessionDepth", () => {
  it("caps depth at 4 and breaks parent cycles", () => {
    const root = session({ id: "root", workspaceId: "w1" });
    const c1 = session({ id: "c1", workspaceId: "w1", parentSessionId: "root" });
    const c2 = session({ id: "c2", workspaceId: "w1", parentSessionId: "c1" });
    const c3 = session({ id: "c3", workspaceId: "w1", parentSessionId: "c2" });
    const c4 = session({ id: "c4", workspaceId: "w1", parentSessionId: "c3" });
    const c5 = session({ id: "c5", workspaceId: "w1", parentSessionId: "c4" });
    const byId = new Map(
      [root, c1, c2, c3, c4, c5].map((item) => [item.id, item]),
    );
    expect(sessionDepth(root, byId)).toBe(0);
    expect(sessionDepth(c1, byId)).toBe(1);
    expect(sessionDepth(c5, byId)).toBe(4);

    const loopA = session({ id: "a", workspaceId: "w1", parentSessionId: "b" });
    const loopB = session({ id: "b", workspaceId: "w1", parentSessionId: "a" });
    const loopMap = new Map([
      ["a", loopA],
      ["b", loopB],
    ]);
    // Walk a→b→a; second hop records "a" then stops on next parent already seen.
    // Depth is hops taken (2), not capped unless chain length > 4.
    expect(sessionDepth(loopA, loopMap)).toBe(2);
  });
});

describe("sessionActivityTime", () => {
  it("prefers updatedAt over createdAt", () => {
    const updated = new Date("2026-07-21T10:00:00");
    const created = new Date("2026-07-01T10:00:00");
    expect(sessionActivityTime(session({ id: "x", workspaceId: "w1", createdAt: created, updatedAt: updated }))).toEqual(
      updated,
    );
    expect(
      sessionActivityTime(session({ id: "y", workspaceId: "w1", createdAt: created, updatedAt: undefined as unknown as Date })),
    ).toEqual(created);
  });
});

describe("groupSessionsByWorkspace", () => {
  it("groups and omits empty workspaces", () => {
    const workspaces: Workspace[] = [
      {
        id: "w1",
        name: "Alpha",
        path: "C:\\a",
        createdAt: new Date(0),
        lastActiveAt: new Date(0),
      },
      {
        id: "w2",
        name: "Beta",
        path: "C:\\b",
        createdAt: new Date(0),
        lastActiveAt: new Date(0),
      },
      {
        id: "w3",
        name: "Empty",
        path: "C:\\c",
        createdAt: new Date(0),
        lastActiveAt: new Date(0),
      },
    ];
    const sessions = [
      session({ id: "s-late", workspaceId: "w1", updatedAt: new Date(200) }),
      session({ id: "s-early", workspaceId: "w1", updatedAt: new Date(100) }),
      session({ id: "s-beta", workspaceId: "w2", updatedAt: new Date(50) }),
    ];
    const groups = groupSessionsByWorkspace(sessions, workspaces);
    expect(groups.map((g) => g.workspace.id)).toEqual(["w1", "w2"]);
    expect(groups[0]?.sessions.map((s) => s.id)).toEqual(["s-late", "s-early"]);
  });
});

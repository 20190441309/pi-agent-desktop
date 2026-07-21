// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { DateGroupedSessionList } from "./DateGroupedSessionList";
import type { Session } from "../../stores/session-store";

const now = Date.now();
const sessions: Session[] = [
  {
    id: "s1",
    title: "Today Chat",
    workspaceId: "w1",
    messages: [],
    createdAt: new Date(now),
    updatedAt: new Date(now),
  } as Session,
  {
    id: "s2",
    title: "Archived Chat",
    workspaceId: "w1",
    messages: [],
    createdAt: new Date(now - 86400000),
    updatedAt: new Date(now - 86400000),
    archived: true,
  } as Session,
];

vi.mock("../../stores/session-store", () => ({
  useSessionStore: (selector: (s: { sessions: Session[] }) => unknown) =>
    selector({ sessions }),
}));

vi.mock("./SessionRow", () => ({
  SessionRow: ({
    session,
    onSelect,
  }: {
    session: Session;
    onSelect: () => void;
  }) => (
    <button type="button" onClick={onSelect}>
      row-{session.title}
    </button>
  ),
}));

describe("DateGroupedSessionList", () => {
  it("shows active sessions and selects via row", () => {
    const onSelect = vi.fn();
    render(
      <I18nProvider>
        <DateGroupedSessionList
          currentSessionId="s1"
          onSelectSession={onSelect}
          onArchiveSession={vi.fn()}
          onDeleteSession={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByText("row-Today Chat")).toBeTruthy();
    expect(screen.queryByText("row-Archived Chat")).toBeNull();
    fireEvent.click(screen.getByText("row-Today Chat"));
    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("date group toggle buttons expose aria-expanded", () => {
    render(
      <I18nProvider>
        <DateGroupedSessionList
          currentSessionId="s1"
          onSelectSession={vi.fn()}
          onArchiveSession={vi.fn()}
          onDeleteSession={vi.fn()}
        />
      </I18nProvider>,
    );
    const groupButtons = screen.getAllByRole("button").filter((btn) =>
      btn.hasAttribute("aria-expanded"),
    );
    expect(groupButtons.length).toBeGreaterThan(0);
    for (const btn of groupButtons) {
      expect(btn.getAttribute("type")).toBe("button");
    }
  });
});

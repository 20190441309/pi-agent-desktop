import { describe, expect, it } from "vitest";
import { getDateGroupLabel, groupSessionsByDate } from "./DateGroupedSessionList";
import type { Session } from "../../stores/session-store";

const t = (key: string): string => key;
// Local calendar anchors avoid UTC/local day-boundary flakiness.
const now = new Date(2026, 6, 21, 12, 0, 0); // 2026-07-21 local

function localDate(year: number, monthIndex: number, day: number, hour = 12): Date {
  return new Date(year, monthIndex, day, hour, 0, 0);
}

function sessionAt(id: string, date: Date): Session {
  return {
    id,
    title: id,
    workspaceId: "w1",
    messages: [],
    createdAt: date,
    updatedAt: date,
  } as Session;
}

describe("getDateGroupLabel", () => {
  it("classifies today / yesterday / week / month / earlier", () => {
    expect(getDateGroupLabel(localDate(2026, 6, 21, 8), t, now)).toBe(
      "sidebar.sessions.dateGroup.today",
    );
    expect(getDateGroupLabel(localDate(2026, 6, 20, 8), t, now)).toBe(
      "sidebar.sessions.dateGroup.yesterday",
    );
    expect(getDateGroupLabel(localDate(2026, 6, 16, 8), t, now)).toBe(
      "sidebar.sessions.dateGroup.thisWeek",
    );
    expect(getDateGroupLabel(localDate(2026, 6, 1, 8), t, now)).toBe(
      "sidebar.sessions.dateGroup.thisMonth",
    );
    expect(getDateGroupLabel(localDate(2026, 4, 1, 8), t, now)).toBe(
      "sidebar.sessions.dateGroup.earlier",
    );
  });
});

describe("groupSessionsByDate", () => {
  it("orders groups and sorts sessions by activity desc", () => {
    const sessions = [
      sessionAt("old", localDate(2026, 4, 1, 10)),
      sessionAt("today-late", localDate(2026, 6, 21, 18)),
      sessionAt("today-early", localDate(2026, 6, 21, 9)),
      sessionAt("yest", localDate(2026, 6, 20, 10)),
    ];
    const groups = groupSessionsByDate(sessions, t, now);
    expect(groups.map((g) => g.label)).toEqual([
      "sidebar.sessions.dateGroup.today",
      "sidebar.sessions.dateGroup.yesterday",
      "sidebar.sessions.dateGroup.earlier",
    ]);
    expect(groups[0]?.sessions.map((s) => s.id)).toEqual(["today-late", "today-early"]);
  });
});

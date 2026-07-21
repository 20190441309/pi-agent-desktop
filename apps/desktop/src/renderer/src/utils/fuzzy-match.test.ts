import { describe, expect, it } from "vitest";
import { fuzzyMatch, fuzzyScore } from "./fuzzy-match";

describe("fuzzyScore / fuzzyMatch", () => {
  it("empty query scores as full match", () => {
    expect(fuzzyScore("anything", "")).toBe(1);
    expect(fuzzyMatch("anything", "")).toBe(true);
  });

  it("prefix substring scores 100", () => {
    expect(fuzzyScore("src/app.ts", "src")).toBe(100);
    expect(fuzzyMatch("src/app.ts", "src")).toBe(true);
  });

  it("segment-boundary substring scores 75", () => {
    expect(fuzzyScore("src/app.ts", "app")).toBe(75);
    expect(fuzzyScore("foo-bar.ts", "bar")).toBe(75);
    expect(fuzzyScore("foo\\bar.ts", "bar")).toBe(75);
  });

  it("mid-token substring scores 50", () => {
    expect(fuzzyScore("application.ts", "plica")).toBe(50);
  });

  it("ordered character match scores 25", () => {
    expect(fuzzyScore("src/components/ChatView.tsx", "scv")).toBe(25);
    expect(fuzzyMatch("src/components/ChatView.tsx", "scv")).toBe(true);
  });

  it("no match scores 0", () => {
    expect(fuzzyScore("readme.md", "xyz")).toBe(0);
    expect(fuzzyMatch("readme.md", "xyz")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(fuzzyScore("PlanMode.ts", "plan")).toBe(100);
    // "mode" is mid-token inside PlanMode → 50 (not segment boundary)
    expect(fuzzyScore("PlanMode.ts", "MODE")).toBe(50);
    expect(fuzzyScore("foo-Bar.ts", "BAR")).toBe(75);
  });
});

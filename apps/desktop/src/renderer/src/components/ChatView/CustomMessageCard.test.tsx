// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomMessageCard } from "./CustomMessageCard";

vi.mock("./GeneratedUiCard", () => ({
  GeneratedUiCard: ({
    card,
    badgeLabel,
  }: {
    card: { id: string; title?: string };
    badgeLabel?: string;
  }) => (
    <div data-testid="generated-ui">
      <span data-testid="badge">{badgeLabel}</span>
      <span data-testid="card-id">{card.id}</span>
      <span data-testid="card-title">{card.title}</span>
    </div>
  ),
}));

describe("CustomMessageCard", () => {
  it("maps legacy card into GeneratedUiCard with kind badge", () => {
    render(
      <CustomMessageCard
        card={{
          id: "c1",
          kind: "task-progress",
          title: "Progress",
          content: "body text",
          items: [{ id: "i1", label: "Step", status: "running" }],
        } as never}
      />,
    );
    expect(screen.getByTestId("badge").textContent).toBe("task-progress");
    expect(screen.getByTestId("card-id").textContent).toBe("c1");
    expect(screen.getByTestId("card-title").textContent).toBe("Progress");
  });
});

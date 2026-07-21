import { describe, expect, it } from "vitest";
import type { GeneratedUiCard } from "@shared";
import {
  mapPlanStepStatus,
  mapUiStatus,
  tasksFromGeneratedUi,
  tasksFromListItems,
  tasksFromMessages,
} from "./TaskOverviewPanel";

describe("mapPlanStepStatus", () => {
  it("maps plan step statuses to TaskStatus", () => {
    expect(mapPlanStepStatus("running")).toBe("running");
    expect(mapPlanStepStatus("completed")).toBe("completed");
    expect(mapPlanStepStatus("failed")).toBe("failed");
    expect(mapPlanStepStatus("blocked")).toBe("failed");
    expect(mapPlanStepStatus("pending")).toBe("pending");
    expect(mapPlanStepStatus("waiting")).toBe("pending");
  });
});

describe("mapUiStatus", () => {
  it("normalizes English and Chinese labels", () => {
    expect(mapUiStatus(undefined)).toBe("pending");
    expect(mapUiStatus("in_progress")).toBe("running");
    expect(mapUiStatus("进行中")).toBe("running");
    expect(mapUiStatus("done")).toBe("completed");
    expect(mapUiStatus("完成")).toBe("completed");
    expect(mapUiStatus("error")).toBe("failed");
    expect(mapUiStatus("失败")).toBe("failed");
    expect(mapUiStatus("unknown")).toBe("pending");
  });
});

describe("tasksFromListItems / GeneratedUi / messages", () => {
  it("skips empty labels and falls back id to name", () => {
    expect(
      tasksFromListItems([
        { id: "", label: "  ", status: "pending" },
        { id: "", label: "Step A", status: "running" },
        { id: "s2", label: "Step B", status: "done" },
      ]),
    ).toEqual([
      { id: "Step A", name: "Step A", status: "running" },
      { id: "s2", name: "Step B", status: "completed" },
    ]);
  });

  it("collects steps from relevant generated-ui sections", () => {
    const card: GeneratedUiCard = {
      version: "v1",
      id: "card-build",
      sections: [
        {
          id: "sec-steps",
          kind: "steps",
          items: [{ id: "1", label: "Build", status: "running" }],
        },
        {
          id: "sec-md",
          kind: "markdown",
          content: "ignore",
        },
      ],
    };
    expect(tasksFromGeneratedUi(card)).toEqual([
      { id: "1", name: "Build", status: "running" },
    ]);
    expect(tasksFromGeneratedUi(undefined)).toEqual([]);
  });

  it("prefers newest message card with tasks", () => {
    const messages = [
      {
        generatedUi: {
          version: "v1" as const,
          id: "old-card",
          sections: [
            {
              id: "old-sec",
              kind: "steps" as const,
              items: [{ id: "old", label: "Old", status: "done" }],
            },
          ],
        } satisfies GeneratedUiCard,
      },
      { generatedUi: undefined },
      {
        generatedUi: {
          version: "v1" as const,
          id: "new-card",
          sections: [
            {
              id: "new-sec",
              kind: "status_list" as const,
              items: [{ id: "new", label: "New", status: "running" }],
            },
          ],
        } satisfies GeneratedUiCard,
      },
    ];
    expect(tasksFromMessages(messages)).toEqual([
      { id: "new", name: "New", status: "running" },
    ]);
    expect(tasksFromMessages([])).toEqual([]);
  });
});

// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const selectSpy = vi.fn();

vi.mock("../../../stores/plan-store", () => ({
  usePlanStore: (selector: (s: { renderedPlanCardIds: string[] }) => unknown) => {
    selectSpy(selector);
    return selector({ renderedPlanCardIds: ["plan-a", "plan-b"] });
  },
}));

import { useRenderedPlanCardIds } from "./useRenderedPlanCardIds";

describe("useRenderedPlanCardIds", () => {
  it("selects renderedPlanCardIds from the plan store", () => {
    const { result } = renderHook(() => useRenderedPlanCardIds());
    expect(result.current).toEqual(["plan-a", "plan-b"]);
    expect(selectSpy).toHaveBeenCalled();
    // selector should read renderedPlanCardIds only
    const selector = selectSpy.mock.calls[0][0] as (s: {
      renderedPlanCardIds: string[];
      other?: number;
    }) => string[];
    expect(selector({ renderedPlanCardIds: ["x"], other: 1 })).toEqual(["x"]);
  });
});

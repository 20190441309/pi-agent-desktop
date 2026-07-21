// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GeneratedUiChart from "./GeneratedUiChart";
import type { ChartSection } from "./GeneratedUiChart";

const setOption = vi.fn();
const dispose = vi.fn();
const resize = vi.fn();

vi.mock("echarts/core", () => ({
  init: () => ({ setOption, dispose, resize }),
  use: vi.fn(),
}));

vi.mock("echarts/charts", () => ({
  BarChart: {},
  LineChart: {},
  PieChart: {},
}));

vi.mock("echarts/components", () => ({
  GridComponent: {},
  LegendComponent: {},
  TooltipComponent: {},
  AriaComponent: {},
}));

vi.mock("echarts/renderers", () => ({
  CanvasRenderer: {},
}));

const pieSection: ChartSection = {
  id: "chart-1",
  kind: "chart",
  chartType: "pie",
  summary: "地区分布",
  xKey: "region",
  series: [{ key: "count" }],
  data: [
    { region: "东", count: 3 },
    { region: "西", count: 5 },
  ],
} as ChartSection;

describe("GeneratedUiChart", () => {
  it("renders accessible figure and caption", async () => {
    render(<GeneratedUiChart section={pieSection} />);
    expect(screen.getByRole("figure", { name: "地区分布" })).toBeTruthy();
    expect(screen.getByText("地区分布")).toBeTruthy();
    await waitFor(() => {
      expect(setOption).toHaveBeenCalled();
    });
  });
});

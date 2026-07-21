import { describe, expect, it } from "vitest";
import { buildChartOption, type ChartSection } from "./GeneratedUiChart";

function section(partial: Partial<ChartSection> & Pick<ChartSection, "chartType">): ChartSection {
  return {
    id: "c1",
    kind: "chart",
    summary: "销量概览",
    xKey: "name",
    series: [{ key: "value", label: "销量" }],
    data: [
      { name: "A", value: 10 },
      { name: "B", value: 20 },
    ],
    ...partial,
  } as ChartSection;
}

describe("buildChartOption", () => {
  it("builds pie series with item tooltip", () => {
    const option = buildChartOption(section({ chartType: "pie" }));
    expect(option.tooltip).toEqual({ trigger: "item" });
    expect(option.xAxis).toBeUndefined();
    const series = option.series as Array<{ type: string; data: Array<{ name: string; value: number }> }>;
    expect(series[0]?.type).toBe("pie");
    expect(series[0]?.data).toEqual([
      { name: "A", value: 10 },
      { name: "B", value: 20 },
    ]);
    expect((option.aria as { description: string }).description).toBe("销量概览");
  });

  it("builds bar series with category axis", () => {
    const option = buildChartOption(section({ chartType: "bar" }));
    expect(option.tooltip).toEqual({ trigger: "axis" });
    expect((option.xAxis as { data: unknown[] }).data).toEqual(["A", "B"]);
    const series = option.series as Array<{ type: string; smooth: boolean; name: string }>;
    expect(series[0]?.type).toBe("bar");
    expect(series[0]?.smooth).toBe(false);
    expect(series[0]?.name).toBe("销量");
  });

  it("builds stacked area/line series", () => {
    const option = buildChartOption(
      section({
        chartType: "area",
        stacked: true,
        series: [
          { key: "value", label: "销量", stack: "g1" },
          { key: "value2", label: "利润" },
        ],
        data: [
          { name: "A", value: 1, value2: 2 },
          { name: "B", value: 3, value2: 4 },
        ],
      }),
    );
    const series = option.series as Array<{
      type: string;
      stack?: string;
      areaStyle?: object;
      smooth: boolean;
    }>;
    expect(series[0]?.type).toBe("line");
    expect(series[0]?.areaStyle).toEqual({});
    expect(series[0]?.smooth).toBe(true);
    expect(series[0]?.stack).toBe("g1");
    expect(series[1]?.stack).toBe("total");
  });
});

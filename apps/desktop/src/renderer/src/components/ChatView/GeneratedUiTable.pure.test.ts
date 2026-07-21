import { describe, expect, it } from "vitest";
import { compareValues, formatValue } from "./GeneratedUiTable";

describe("GeneratedUiTable pure helpers", () => {
  it("compareValues sorts numbers and strings", () => {
    expect(compareValues(1, 10)).toBeLessThan(0);
    expect(compareValues(10, 1)).toBeGreaterThan(0);
    expect(compareValues("a", "b")).toBeLessThan(0);
    expect(compareValues(null, "x")).toBeLessThan(0);
    expect(compareValues("file2", "file10")).toBeLessThan(0);
  });

  it("formatValue handles null, bool, number, percent", () => {
    expect(formatValue(null, "text")).toBe("");
    expect(formatValue(true, "text")).toBe("是");
    expect(formatValue(false, "text")).toBe("否");
    expect(formatValue(1234.5, "number")).toMatch(/1[,.]?234/);
    expect(formatValue(12.5, "percent")).toContain("%");
    expect(formatValue("plain", "text")).toBe("plain");
  });
});

import { describe, expect, it } from "vitest";
import { initialFieldValue, isEmptyFieldValue } from "./GeneratedUiForm";
import type { GeneratedUiFormField } from "@shared";

describe("GeneratedUiForm pure helpers", () => {
  it("initialFieldValue defaults by field kind", () => {
    expect(
      initialFieldValue({ id: "c", label: "C", kind: "checkbox" } as GeneratedUiFormField),
    ).toBe(false);
    expect(
      initialFieldValue({
        id: "c",
        label: "C",
        kind: "checkbox",
        defaultValue: true,
      } as GeneratedUiFormField),
    ).toBe(true);
    expect(
      initialFieldValue({ id: "m", label: "M", kind: "multi-select", options: [] } as GeneratedUiFormField),
    ).toEqual([]);
    expect(
      initialFieldValue({ id: "n", label: "N", kind: "number" } as GeneratedUiFormField),
    ).toBe("");
    expect(
      initialFieldValue({ id: "t", label: "T", kind: "text", defaultValue: "hi" } as GeneratedUiFormField),
    ).toBe("hi");
  });

  it("isEmptyFieldValue treats empty forms as empty", () => {
    expect(isEmptyFieldValue("")).toBe(true);
    expect(isEmptyFieldValue(false)).toBe(true);
    expect(isEmptyFieldValue([])).toBe(true);
    expect(isEmptyFieldValue("x")).toBe(false);
    expect(isEmptyFieldValue(true)).toBe(false);
    expect(isEmptyFieldValue(["a"])).toBe(false);
    expect(isEmptyFieldValue(0)).toBe(false);
  });
});

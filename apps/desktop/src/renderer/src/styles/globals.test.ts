import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("global interaction styles", () => {
  it("does not apply press scaling to every interactive element", () => {
    const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

    expect(css).not.toMatch(/:is\(button,[^}]+:active[^}]+scale:\s*0\.96/s);
  });

  it("keeps Markdown code blocks readable in narrow chat columns", () => {
    const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.markdown-body pre\s*\{[^}]*white-space:\s*pre-wrap/s);
    expect(css).toMatch(/\.markdown-body pre\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    expect(css).toMatch(/\.markdown-body pre\s*\{[^}]*line-height:\s*1\.75/s);
  });
});

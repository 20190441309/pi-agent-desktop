import { describe, expect, it } from "vitest";
import { wildcardMatch } from "../wildcard";

describe("wildcardMatch", () => {
  it("matches exact strings", () => {
    expect(wildcardMatch("read", "read")).toBe(true);
    expect(wildcardMatch("write", "read")).toBe(false);
  });

  it("supports * and ? wildcards", () => {
    expect(wildcardMatch(".env", "*.env")).toBe(true);
    expect(wildcardMatch("local.env", "*.env")).toBe(true);
    expect(wildcardMatch("a", "?")).toBe(true);
    expect(wildcardMatch("ab", "?")).toBe(false);
  });

  it("treats trailing ' *' as optional args", () => {
    expect(wildcardMatch("ls", "ls *")).toBe(true);
    expect(wildcardMatch("ls -la", "ls *")).toBe(true);
    expect(wildcardMatch("lsof", "ls *")).toBe(false);
  });

  it("normalizes backslashes and is case-insensitive on win32", () => {
    expect(wildcardMatch("C:\\Users\\x", "C:/Users/x")).toBe(true);
    if (process.platform === "win32") {
      expect(wildcardMatch("C:\\Users\\x", "c:/users/x")).toBe(true);
    }
    expect(wildcardMatch("Foo", "Foo")).toBe(true);
  });
});

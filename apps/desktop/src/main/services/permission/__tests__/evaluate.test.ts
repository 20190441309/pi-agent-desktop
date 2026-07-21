import { describe, expect, it } from "vitest";
import { disabled, evaluate, fromConfig, merge } from "../evaluate";
import type { PermissionRuleset } from "../types";

describe("permission evaluate engine", () => {
  it("defaults to ask when no rule matches", () => {
    const rule = evaluate("bash", "rm -rf /", []);
    expect(rule.action).toBe("ask");
    expect(rule.permission).toBe("bash");
    expect(rule.pattern).toBe("*");
  });

  it("uses the last matching rule (later wins)", () => {
    const ruleset: PermissionRuleset = [
      { permission: "edit", pattern: "*", action: "allow" },
      { permission: "edit", pattern: "*.env", action: "deny" },
      { permission: "edit", pattern: "local.env", action: "ask" },
    ];
    expect(evaluate("edit", "src/a.ts", ruleset).action).toBe("allow");
    expect(evaluate("edit", "prod.env", ruleset).action).toBe("deny");
    expect(evaluate("edit", "local.env", ruleset).action).toBe("ask");
  });

  it("merges rulesets by flattening", () => {
    const a: PermissionRuleset = [{ permission: "read", pattern: "*", action: "allow" }];
    const b: PermissionRuleset = [{ permission: "read", pattern: "*.env", action: "deny" }];
    expect(merge(a, b)).toEqual([...a, ...b]);
  });

  it("fromConfig expands string and nested pattern maps", () => {
    const rules = fromConfig({
      edit: "deny",
      read: { "*": "allow", "*.env": "ask" },
    });
    expect(rules).toEqual(
      expect.arrayContaining([
        { permission: "edit", pattern: "*", action: "deny" },
        { permission: "read", pattern: "*", action: "allow" },
        { permission: "read", pattern: "*.env", action: "ask" },
      ]),
    );
  });

  it("fromConfig expands ~/ patterns to absolute home paths", () => {
    const rules = fromConfig({ read: { "~/secret": "deny" } });
    expect(rules).toHaveLength(1);
    expect(rules[0].pattern).not.toMatch(/^~/);
    expect(rules[0].pattern.length).toBeGreaterThan(1);
    expect(rules[0].action).toBe("deny");
  });

  it("disabled only removes tools denied with pattern *", () => {
    const ruleset: PermissionRuleset = [
      { permission: "bash", pattern: "*", action: "deny" },
      { permission: "edit", pattern: "*.env", action: "deny" },
      { permission: "write", pattern: "*", action: "deny" },
    ];
    const removed = disabled(["bash", "write", "edit", "read"], ruleset);
    expect(removed.has("bash")).toBe(true);
    expect(removed.has("write")).toBe(true);
    // edit-family matches write deny via EDIT_TOOLS alias only when permission is "edit"
    // write deny applies to write tool; edit stays because pattern is not *
    expect(removed.has("edit")).toBe(false);
    expect(removed.has("read")).toBe(false);
  });

  it("disabled treats edit-family tools as matching permission 'edit'", () => {
    const ruleset: PermissionRuleset = [
      { permission: "edit", pattern: "*", action: "deny" },
    ];
    const removed = disabled(["edit", "write", "apply_patch", "multiedit", "read"], ruleset);
    expect(removed.has("edit")).toBe(true);
    expect(removed.has("write")).toBe(true);
    expect(removed.has("apply_patch")).toBe(true);
    expect(removed.has("multiedit")).toBe(true);
    expect(removed.has("read")).toBe(false);
  });
});

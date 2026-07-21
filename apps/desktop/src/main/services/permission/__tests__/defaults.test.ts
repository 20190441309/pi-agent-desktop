import { describe, expect, it } from "vitest";
import { buildDefaults } from "../defaults";
import { evaluate } from "../evaluate";

describe("buildDefaults", () => {
  const whitelist = ["C:/Users/demo/AppData/Pi/memory", "C:/Users/demo/AppData/Pi/plans", "C:/Temp"];
  const rules = buildDefaults(whitelist);

  it("allows ordinary reads and asks on env secrets", () => {
    expect(evaluate("read", "src/app.ts", rules).action).toBe("allow");
    expect(evaluate("read", ".env", rules).action).toBe("ask");
    expect(evaluate("read", ".env.local", rules).action).toBe("ask");
    expect(evaluate("read", ".env.example", rules).action).toBe("allow");
  });

  it("asks on doom_loop and denies question by default", () => {
    expect(evaluate("doom_loop", "*", rules).action).toBe("ask");
    expect(evaluate("question", "*", rules).action).toBe("deny");
  });

  it("asks for external directories except the whitelist", () => {
    expect(evaluate("external_directory", "C:/Windows/System32", rules).action).toBe("ask");
    expect(
      evaluate("external_directory", "C:/Users/demo/AppData/Pi/memory/notes.md", rules).action,
    ).toBe("allow");
    expect(evaluate("external_directory", "C:/Temp/scratch.log", rules).action).toBe("allow");
  });
});

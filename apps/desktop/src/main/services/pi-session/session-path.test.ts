import { join } from "path";
import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { resolveNativeSessionPath } from "./session-path";

describe("resolveNativeSessionPath", () => {
  it("builds stable hashed jsonl path under pi-sessions", () => {
    const sessionId = "sess_ABC-123.demo";
    const path = resolveNativeSessionPath("C:\\UserData\\Pi", sessionId);
    const readable = "sess_abc-123.demo".slice(0, 48);
    const hash = createHash("sha256").update(sessionId, "utf8").digest("hex").slice(0, 16);
    expect(path).toBe(join("C:\\UserData\\Pi", "pi-sessions", `${readable}-${hash}.jsonl`));
  });

  it("rejects invalid session ids", () => {
    expect(() => resolveNativeSessionPath("/tmp/u", "../escape")).toThrow(/Invalid desktop session id/);
    expect(() => resolveNativeSessionPath("/tmp/u", "bad id")).toThrow(/Invalid desktop session id/);
    expect(() => resolveNativeSessionPath("/tmp/u", "ok@id")).toThrow(/Invalid desktop session id/);
  });

  it("trims trailing dots in readable fragment and keeps stable hash", () => {
    const sessionId = "a....";
    const path = resolveNativeSessionPath("/data", sessionId);
    expect(path.startsWith(join("/data", "pi-sessions"))).toBe(true);
    expect(path.endsWith(".jsonl")).toBe(true);
    expect(path).toMatch(/a-[0-9a-f]{16}\.jsonl$/);
  });
});

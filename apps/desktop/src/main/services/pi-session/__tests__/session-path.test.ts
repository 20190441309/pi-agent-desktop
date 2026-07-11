import { describe, expect, it } from "vitest";
import { resolveNativeSessionPath } from "../session-path";

describe("resolveNativeSessionPath", () => {
    it("maps a desktop session id to one stable JSONL path", () => {
        expect(resolveNativeSessionPath("C:/user-data", "session-123"))
            .toBe("C:\\user-data\\pi-sessions\\session-123-b9c84322f82434cb.jsonl");
    });

    it.each(["", "../auth", "session/child", "session\\child", "session id", "会话"])(
        "rejects invalid desktop session id %j",
        (sessionId) => {
            expect(() => resolveNativeSessionPath("C:/user-data", sessionId))
                .toThrow("Invalid desktop session id");
        },
    );

    it.each(["session_123", "session.123", "SESSION-123"])(
        "allows the documented filename characters in %s",
        (sessionId) => {
            expect(resolveNativeSessionPath("C:/user-data", sessionId))
                .toMatch(/^C:\\user-data\\pi-sessions\\[a-z0-9._-]+-[a-f0-9]{16}\.jsonl$/);
        },
    );

    it("does not collide when Windows folds filename case", () => {
        const upper = resolveNativeSessionPath("C:/user-data", "Session-A");
        const lower = resolveNativeSessionPath("C:/user-data", "session-a");

        expect(upper).toBe("C:\\user-data\\pi-sessions\\session-a-70d359e1f21e1bfd.jsonl");
        expect(lower).toBe("C:\\user-data\\pi-sessions\\session-a-fa57a52dbf081902.jsonl");
        expect(upper.toLowerCase()).not.toBe(lower.toLowerCase());
    });

    it.each([
        ["CON", "con-a3dbc4b644a9a2c5.jsonl"],
        ["name.", "name-f8f47e4731f66a0a.jsonl"],
        [".", "session-cdb4ee2aea69cc6a.jsonl"],
        ["..", "session-5ec1f7e700f37c3d.jsonl"],
    ])("maps Windows-special id %s to a regular filename", (sessionId, filename) => {
        expect(resolveNativeSessionPath("C:/user-data", sessionId))
            .toBe(`C:\\user-data\\pi-sessions\\${filename}`);
    });

    it("is stable for repeated calls with the same original id", () => {
        const first = resolveNativeSessionPath("C:/user-data", "Session-A");

        expect(resolveNativeSessionPath("C:/user-data", "Session-A")).toBe(first);
    });
});

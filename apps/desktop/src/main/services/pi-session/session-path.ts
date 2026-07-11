import { join } from "path";
import { createHash } from "crypto";

const DESKTOP_SESSION_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

export function resolveNativeSessionPath(userDataPath: string, sessionId: string): string {
    if (!DESKTOP_SESSION_ID_PATTERN.test(sessionId)) {
        throw new Error("Invalid desktop session id");
    }

    const readableFragment = sessionId
        .toLowerCase()
        .replace(/\.+$/, "")
        .slice(0, 48)
        .replace(/\.+$/, "") || "session";
    const stableHash = createHash("sha256").update(sessionId, "utf8").digest("hex").slice(0, 16);
    return join(userDataPath, "pi-sessions", `${readableFragment}-${stableHash}.jsonl`);
}

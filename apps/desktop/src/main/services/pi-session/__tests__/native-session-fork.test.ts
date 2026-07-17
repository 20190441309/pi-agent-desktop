import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Message as DesktopMessage } from "@shared";
import { forkNativeSession } from "../native-session-fork";
import { loadPiSdk } from "../sdk-runtime";

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(resolve(dir), { recursive: true, force: true });
});

function makeTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "pi-native-fork-"));
    tempDirs.push(dir);
    return dir;
}

function desktopHistory(): DesktopMessage[] {
    return [
        { id: "m1", role: "user", content: "first", timestamp: new Date(1) },
        { id: "m2", role: "assistant", content: "second", timestamp: new Date(2) },
        { id: "m3", role: "user", content: "third", timestamp: new Date(3) },
    ];
}

describe("forkNativeSession", () => {
    it("creates a real Pi branch ending at the selected desktop message", async () => {
        const sdk = await loadPiSdk();
        const dir = makeTempDir();
        const source = sdk.SessionManager.create(dir, dir);
        source.appendMessage({ role: "user", content: "first", timestamp: 1 });
        source.appendMessage({
            role: "assistant",
            content: [{ type: "text", text: "second" }],
            api: "openai-completions",
            provider: "test",
            model: "test-model",
            usage: {
                input: 1,
                output: 1,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 2,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            stopReason: "stop",
            timestamp: 2,
        });
        source.appendMessage({ role: "user", content: "third", timestamp: 3 });
        const sourcePath = source.getSessionFile();
        if (!sourcePath) throw new Error("source session was not persisted");
        const targetPath = join(dir, "target.jsonl");

        await forkNativeSession({
            sourcePath,
            targetPath,
            targetCwd: dir,
            messages: desktopHistory(),
            fromMessageId: "m2",
        });

        const reopened = sdk.SessionManager.open(targetPath);
        expect(reopened.buildSessionContext().messages.map((message) => message.role)).toEqual(["user", "assistant"]);
        expect(reopened.getHeader()?.parentSession).toBe(sourcePath);
    });

    it("converts imported desktop history into a resumable Pi JSONL session", async () => {
        const sdk = await loadPiSdk();
        const dir = makeTempDir();
        const targetPath = join(dir, "imported.jsonl");

        await forkNativeSession({
            sourcePath: join(dir, "missing.jsonl"),
            targetPath,
            targetCwd: dir,
            messages: desktopHistory(),
            provider: "test",
            model: "test-model",
        });

        const reopened = sdk.SessionManager.open(targetPath);
        expect(reopened.buildSessionContext().messages.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
    });
});

import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteSessionRepository } from "../sqlite-session-repository";

describe("SqliteSessionRepository", () => {
    const dirs: string[] = [];
    const repositories: SqliteSessionRepository[] = [];

    afterEach(() => {
        for (const repository of repositories.splice(0)) repository.close();
        for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    });

    function createRepository(): SqliteSessionRepository {
        const dir = mkdtempSync(join(tmpdir(), "pi-session-sqlite-"));
        dirs.push(dir);
        const repository = new SqliteSessionRepository(dir);
        repositories.push(repository);
        return repository;
    }

    it("stores messages incrementally while summaries stay transcript-free", async () => {
        const repository = createRepository();
        const session = await repository.createSession("w1", "SQLite session", "s1");

        await repository.appendMessage(session.id, {
            id: "m1",
            role: "assistant",
            content: "partial",
            thinking: "reasoning",
            timestamp: new Date(1000),
            generatedUi: {
                version: "v1",
                id: "card-1",
                sections: [{ id: "summary", kind: "summary", content: "card content" }],
            },
            toolCalls: [{
                id: "tc1",
                name: "read",
                status: "running",
                input: { path: "README.md" },
                startTime: new Date(1100),
            }],
        });
        await repository.updateMessage("s1", "m1", { content: "final answer" });
        await repository.updateToolCall("s1", "m1", "tc1", {
            status: "completed",
            output: { ok: true },
            endTime: new Date(1200),
        });

        const summaries = await repository.listSessionSummaries();
        expect(summaries).toEqual([expect.objectContaining({
            id: "s1",
            workspaceId: "w1",
            messageCount: 1,
            toolCallCount: 1,
        })]);
        expect(summaries[0]).not.toHaveProperty("messages");

        const loaded = await repository.getSession("s1");
        expect(loaded?.messages).toHaveLength(1);
        expect(loaded?.messages[0]).toMatchObject({
            id: "m1",
            content: "final answer",
            thinking: "reasoning",
            generatedUi: { version: "v1", id: "card-1" },
        });
        expect(loaded?.messages[0].toolCalls?.[0]).toMatchObject({
            id: "tc1",
            status: "completed",
            input: { path: "README.md" },
            output: { ok: true },
        });

        const search = await repository.searchSessionMessages({ query: "final", limit: 10 });
        expect(search).toEqual([expect.objectContaining({
            sessionId: "s1",
            messageId: "m1",
            messageContent: expect.stringContaining("final answer"),
        })]);
        expect(await repository.searchSessionMessages({ query: "card content", limit: 10 }))
            .toEqual([expect.objectContaining({ messageId: "m1" })]);
    });

    it("finds hyphenated needles via LIKE fallback when FTS token OR returns no hit", async () => {
        const repository = createRepository();
        await repository.createSession("w1", "Search session", "s-search");
        await repository.appendMessage("s-search", {
            id: "m-search",
            role: "user",
            content: "search-floating-needle 顶部历史搜索应该打开这条消息",
            timestamp: new Date(2_000),
        });

        const hits = await repository.searchSessionMessages({
            query: "search-floating-needle",
            limit: 10,
        });
        expect(hits).toEqual([expect.objectContaining({
            sessionId: "s-search",
            messageId: "m-search",
            messageContent: expect.stringContaining("search-floating-needle"),
        })]);
    });

    it("does not return partial FTS token matches for multi-token needles", async () => {
        const repository = createRepository();
        await repository.createSession("w1", "Search session", "s-search");
        await repository.appendMessage("s-search", {
            id: "m-user",
            role: "user",
            content: "search-floating-needle 顶部历史搜索应该打开这条消息",
            timestamp: new Date(2_000),
        });
        await repository.appendMessage("s-search", {
            id: "m-assistant",
            role: "assistant",
            content: "search-floating-assistant-reply",
            timestamp: new Date(3_000),
        });

        const hits = await repository.searchSessionMessages({
            query: "search-floating-needle",
            limit: 10,
        });
        expect(hits).toHaveLength(1);
        expect(hits[0]).toEqual(expect.objectContaining({
            messageId: "m-user",
            messageContent: expect.stringContaining("search-floating-needle"),
        }));
    });
});

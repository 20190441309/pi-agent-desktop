import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VerdictSchema } from "../judge-prompt";
import {
    JudgeModelClient,
    parseVerdict,
    type CompleteParams,
    type ModelMessage,
    type ResolvedModel,
    type ResolvedProvider,
} from "../judge-model-client";

// Minimal Response-like object — full Response has many fields we don't use.
interface MockResponse {
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): MockResponse {
    return {
        ok: init.ok ?? true,
        status: init.status ?? 200,
        json: async () => body,
    };
}

const originalFetch = global.fetch;

beforeEach(() => {
    // Each test sets its own fetch mock; default to a no-op that fails if called.
    global.fetch = vi.fn();
});

afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
});

const okProvider: ResolvedProvider = {
    id: "test-anthropic",
    baseUrl: "https://api.anthropic.com",
    api: "anthropic-messages",
    apiKey: "sk-ant-test",
};

const okModel: ResolvedModel = { id: "claude-test" };

const messages: ModelMessage[] = [
    { role: "system", content: "JUDGE_SYSTEM" },
    { role: "user", content: "have we satisfied the condition?" },
];

const okVerdictBody = '{"ok":true,"reason":"transcript shows the work is done"}';
const notOkVerdictBody = '{"ok":false,"reason":"insufficient evidence"}';
const impossibleVerdictBody = '{"ok":false,"impossible":true,"reason":"contradiction"}';

function makeClient(): JudgeModelClient {
    return new JudgeModelClient({
        resolveProvider: vi.fn().mockResolvedValue(okProvider),
        resolveApiKey: vi.fn().mockResolvedValue("sk-test"),
    });
}

describe("JudgeModelClient.complete", () => {
    describe("anthropic-messages", () => {
        it("posts to /messages with anthropic auth headers and parses content[0].text", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);
            fetchMock.mockResolvedValue(
                mockResponse({ content: [{ type: "text", text: okVerdictBody }] }) as unknown as Response,
            );

            const verdict = await client.complete({
                provider: okProvider,
                model: okModel,
                messages,
                schema: VerdictSchema,
            });

            expect(verdict).toEqual({ ok: true, reason: "transcript shows the work is done" });

            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe("https://api.anthropic.com/messages");
            expect(init?.method).toBe("POST");
            const headers = (init as RequestInit).headers as Record<string, string>;
            expect(headers["x-api-key"]).toBe("sk-ant-test");
            expect(headers["anthropic-version"]).toBe("2023-06-01");
            expect(headers["content-type"]).toBe("application/json");
            const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
            expect(body["model"]).toBe("claude-test");
            expect(body["max_tokens"]).toBe(1024);
            expect(body["temperature"]).toBe(0);
            expect(body["system"]).toBe("JUDGE_SYSTEM");
            expect(body["messages"]).toEqual([{ role: "user", content: "have we satisfied the condition?" }]);
        });

        it("omits the system field when no system message is present", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);
            fetchMock.mockResolvedValue(
                mockResponse({ content: [{ type: "text", text: notOkVerdictBody }] }) as unknown as Response,
            );

            await client.complete({
                provider: okProvider,
                model: okModel,
                messages: [{ role: "user", content: "ping" }],
                schema: VerdictSchema,
            });

            const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
            expect("system" in body).toBe(false);
            expect(body["messages"]).toEqual([{ role: "user", content: "ping" }]);
        });
    });

    describe("openai-responses", () => {
        it("posts to /responses with bearer auth and parses output_text", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);
            fetchMock.mockResolvedValue(mockResponse({ output_text: okVerdictBody }) as unknown as Response);

            const verdict = await client.complete({
                provider: { ...okProvider, id: "openai", api: "openai-responses", apiKey: "sk-oai-test" },
                model: okModel,
                messages,
                schema: VerdictSchema,
                temperature: 0.2,
            });

            expect(verdict).toEqual({ ok: true, reason: "transcript shows the work is done" });

            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe("https://api.anthropic.com/responses");
            expect(init?.method).toBe("POST");
            const headers = (init as RequestInit).headers as Record<string, string>;
            expect(headers["Authorization"]).toBe("Bearer sk-oai-test");
            expect(headers["content-type"]).toBe("application/json");
            const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
            expect(body["model"]).toBe("claude-test");
            expect(body["temperature"]).toBe(0.2);
            expect(body["instructions"]).toBe("JUDGE_SYSTEM");
            expect(body["input"]).toEqual([{ role: "user", content: "have we satisfied the condition?" }]);
        });

        it("falls back to output[0].content[0].text when output_text is absent", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);
            fetchMock.mockResolvedValue(
                mockResponse({ output: [{ content: [{ type: "text", text: impossibleVerdictBody }] }] }) as unknown as Response,
            );

            const verdict = await client.complete({
                provider: { ...okProvider, api: "openai-responses" },
                model: okModel,
                messages,
                schema: VerdictSchema,
            });

            expect(verdict).toEqual({ ok: false, impossible: true, reason: "contradiction" });
        });
    });

    describe("openai-codex-responses", () => {
        it("routes to the responses endpoint same as openai-responses", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);
            fetchMock.mockResolvedValue(mockResponse({ output_text: okVerdictBody }) as unknown as Response);

            await client.complete({
                provider: { ...okProvider, api: "openai-codex-responses" },
                model: okModel,
                messages,
                schema: VerdictSchema,
            });

            expect(fetchMock.mock.calls[0][0]).toBe("https://api.anthropic.com/responses");
        });
    });

    describe("openai-completions", () => {
        it("posts to /chat/completions with response_format json_object and parses choices[0].message.content", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);
            fetchMock.mockResolvedValue(
                mockResponse({ choices: [{ message: { content: notOkVerdictBody } }] }) as unknown as Response,
            );

            const verdict = await client.complete({
                provider: { ...okProvider, api: "openai-completions" },
                model: okModel,
                messages,
                schema: VerdictSchema,
            });

            expect(verdict).toEqual({ ok: false, reason: "insufficient evidence" });

            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe("https://api.anthropic.com/chat/completions");
            const headers = (init as RequestInit).headers as Record<string, string>;
            expect(headers["Authorization"]).toBe("Bearer sk-ant-test");
            const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
            expect(body["response_format"]).toEqual({ type: "json_object" });
            // openai-completions keeps the system message inline (no extraction).
            expect(body["messages"]).toEqual(messages);
            expect("instructions" in body).toBe(false);
        });
    });

    describe("error handling", () => {
        it("throws when the API branch is unsupported", async () => {
            const client = makeClient();
            await expect(
                client.complete({
                    provider: { ...okProvider, api: "google-generative-ai" },
                    model: okModel,
                    messages,
                    schema: VerdictSchema,
                }),
            ).rejects.toThrow("judge unsupported provider api: google-generative-ai");
        });

        it("throws when provider has no baseUrl", async () => {
            const client = makeClient();
            await expect(
                client.complete({
                    provider: { id: "p", api: "anthropic-messages", apiKey: "k" },
                    model: okModel,
                    messages,
                    schema: VerdictSchema,
                }),
            ).rejects.toThrow("judge provider p missing baseUrl");
        });

        it("throws on non-2xx HTTP status with body context", async () => {
            const client = makeClient();
            vi.mocked(global.fetch).mockResolvedValue(
                mockResponse(
                    { error: { message: "rate limited" } },
                    { ok: false, status: 429 },
                ) as unknown as Response,
            );

            await expect(
                client.complete({
                    provider: okProvider,
                    model: okModel,
                    messages,
                    schema: VerdictSchema,
                }),
            ).rejects.toThrow("judge anthropic request failed: HTTP 429: rate limited");
        });

        it("throws on 500 with non-error body", async () => {
            const client = makeClient();
            vi.mocked(global.fetch).mockResolvedValue(
                mockResponse({ ok: false }, { ok: false, status: 500 }) as unknown as Response,
            );

            await expect(
                client.complete({
                    provider: { ...okProvider, api: "openai-completions" },
                    model: okModel,
                    messages,
                    schema: VerdictSchema,
                }),
            ).rejects.toThrow("judge openai-completions request failed: HTTP 500");
        });

        it("throws when response body is not JSON", async () => {
            const client = makeClient();
            vi.mocked(global.fetch).mockResolvedValue(
                mockResponse({ content: [{ type: "text", text: "this is not json" }] }) as unknown as Response,
            );

            await expect(
                client.complete({
                    provider: okProvider,
                    model: okModel,
                    messages,
                    schema: VerdictSchema,
                }),
            ).rejects.toThrow("judge response malformed: JSON parse failed");
        });

        it("throws when JSON does not match VerdictSchema (missing ok)", async () => {
            const client = makeClient();
            vi.mocked(global.fetch).mockResolvedValue(
                mockResponse({ content: [{ type: "text", text: '{"reason":"no ok field"}' }] }) as unknown as Response,
            );

            await expect(
                client.complete({
                    provider: okProvider,
                    model: okModel,
                    messages,
                    schema: VerdictSchema,
                }),
            ).rejects.toThrow("judge response malformed: schema validation failed");
        });

        it("throws when the anthropic response lacks text content", async () => {
            const client = makeClient();
            vi.mocked(global.fetch).mockResolvedValue(
                mockResponse({ content: [] }) as unknown as Response,
            );

            await expect(
                client.complete({
                    provider: okProvider,
                    model: okModel,
                    messages,
                    schema: VerdictSchema,
                }),
            ).rejects.toThrow("judge anthropic response missing text content");
        });

        it("strips ```json code fences before parsing", async () => {
            const client = makeClient();
            const fenced = "```json\n" + okVerdictBody + "\n```";
            vi.mocked(global.fetch).mockResolvedValue(
                mockResponse({ content: [{ type: "text", text: fenced }] }) as unknown as Response,
            );

            const verdict = await client.complete({
                provider: okProvider,
                model: okModel,
                messages,
                schema: VerdictSchema,
            });

            expect(verdict.ok).toBe(true);
        });
    });

    describe("SSRF guard", () => {
        it("rejects cloud metadata baseUrl (169.254.169.254) without calling fetch", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);

            await expect(
                client.complete({
                    provider: {
                        id: "ssrf",
                        baseUrl: "http://169.254.169.254",
                        api: "anthropic-messages",
                        apiKey: "k",
                    },
                    model: okModel,
                    messages,
                    schema: VerdictSchema,
                }),
            ).rejects.toThrow("judge baseUrl unsafe: http://169.254.169.254");

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("rejects GCP metadata hostname without calling fetch", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);

            await expect(
                client.complete({
                    provider: {
                        id: "ssrf-gcp",
                        baseUrl: "http://metadata.google.internal/computeMetadata/v1",
                        api: "openai-completions",
                        apiKey: "k",
                    },
                    model: okModel,
                    messages,
                    schema: VerdictSchema,
                }),
            ).rejects.toThrow("judge baseUrl unsafe");

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("rejects non-http ftp baseUrl without calling fetch", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);

            await expect(
                client.complete({
                    provider: {
                        id: "ftp",
                        baseUrl: "ftp://example.com/api",
                        api: "anthropic-messages",
                        apiKey: "k",
                    },
                    model: okModel,
                    messages,
                    schema: VerdictSchema,
                }),
            ).rejects.toThrow("judge baseUrl unsafe: ftp://example.com/api");

            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("base URL trimming", () => {
        it("strips trailing slashes from baseUrl before building the request URL", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);
            fetchMock.mockResolvedValue(
                mockResponse({ content: [{ type: "text", text: okVerdictBody }] }) as unknown as Response,
            );

            await client.complete({
                provider: { ...okProvider, baseUrl: "https://api.anthropic.com/" },
                model: okModel,
                messages,
                schema: VerdictSchema,
            });

            expect(fetchMock.mock.calls[0][0]).toBe("https://api.anthropic.com/messages");
        });

        it("strips multiple trailing slashes", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);
            fetchMock.mockResolvedValue(mockResponse({ output_text: okVerdictBody }) as unknown as Response);

            await client.complete({
                provider: {
                    ...okProvider,
                    baseUrl: "https://api.openai.com///",
                    api: "openai-responses",
                },
                model: okModel,
                messages,
                schema: VerdictSchema,
            });

            expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/responses");
        });
    });

    describe("header merging", () => {
        it("merges provider.headers and model.headers (model wins) into the request", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);
            fetchMock.mockResolvedValue(
                mockResponse({ content: [{ type: "text", text: okVerdictBody }] }) as unknown as Response,
            );

            await client.complete({
                provider: {
                    ...okProvider,
                    headers: { "X-Provider": "from-provider", "X-Shared": "from-provider" },
                },
                model: { id: "m", headers: { "X-Model": "from-model", "X-Shared": "from-model" } },
                messages,
                schema: VerdictSchema,
            });

            const headers = (fetchMock.mock.calls[0][1].headers as Record<string, string>);
            // Provider headers survive when model does not override them.
            expect(headers["X-Provider"]).toBe("from-provider");
            // Model headers are present.
            expect(headers["X-Model"]).toBe("from-model");
            // Model headers win over provider headers on conflicts.
            expect(headers["X-Shared"]).toBe("from-model");
            // Auth headers derived from provider.apiKey are still set.
            expect(headers["x-api-key"]).toBe("sk-ant-test");
            expect(headers["anthropic-version"]).toBe("2023-06-01");
        });

        it("uses Bearer auth for openai-completions when apiKey is set", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);
            fetchMock.mockResolvedValue(
                mockResponse({ choices: [{ message: { content: okVerdictBody } }] }) as unknown as Response,
            );

            await client.complete({
                provider: { ...okProvider, api: "openai-completions", apiKey: "sk-completions" },
                model: okModel,
                messages,
                schema: VerdictSchema,
            });

            const headers = (fetchMock.mock.calls[0][1].headers as Record<string, string>);
            expect(headers["Authorization"]).toBe("Bearer sk-completions");
            expect(headers["x-api-key"]).toBeUndefined();
        });
    });

    describe("temperature default", () => {
        it("defaults temperature to 0 when not provided", async () => {
            const client = makeClient();
            const fetchMock = vi.mocked(global.fetch);
            fetchMock.mockResolvedValue(
                mockResponse({ content: [{ type: "text", text: okVerdictBody }] }) as unknown as Response,
            );

            const params: CompleteParams = {
                provider: okProvider,
                model: okModel,
                messages,
                schema: VerdictSchema,
                // temperature intentionally omitted
            };
            await client.complete(params);

            const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
            expect(body["temperature"]).toBe(0);
        });
    });
});

describe("parseVerdict", () => {
    it("parses a valid ok=true verdict", () => {
        expect(parseVerdict('{"ok":true,"reason":"done"}', VerdictSchema)).toEqual({
            ok: true,
            reason: "done",
        });
    });

    it("parses a verdict with impossible=true", () => {
        expect(parseVerdict('{"ok":false,"impossible":true,"reason":"x"}', VerdictSchema)).toEqual({
            ok: false,
            impossible: true,
            reason: "x",
        });
    });

    it("throws on JSON parse failure", () => {
        expect(() => parseVerdict("not json", VerdictSchema)).toThrow(
            "judge response malformed: JSON parse failed",
        );
    });

    it("throws on schema validation failure (ok missing)", () => {
        expect(() => parseVerdict('{"reason":"no ok"}', VerdictSchema)).toThrow(
            "judge response malformed: schema validation failed",
        );
    });

    it("strips ```json fences", () => {
        expect(parseVerdict("```json\n" + '{"ok":true,"reason":"y"}' + "\n```", VerdictSchema)).toEqual({
            ok: true,
            reason: "y",
        });
    });

    it("strips bare ``` fences", () => {
        expect(parseVerdict("```\n" + '{"ok":true,"reason":"y"}' + "\n```", VerdictSchema)).toEqual({
            ok: true,
            reason: "y",
        });
    });
});

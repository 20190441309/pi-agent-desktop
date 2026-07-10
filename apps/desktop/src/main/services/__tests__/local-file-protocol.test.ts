import { join } from "path";
import { tmpdir } from "os";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// audit round 3, Task 3.4: cover the localfile:// workspace-boundary enforcement.
// The protocol handler is captured by mocking electron.protocol.handle, then
// invoked directly with synthetic Request objects so we can assert on the
// Response status without spinning up a real Electron session.

let capturedHandler: ((request: { url: string }) => Response | Promise<Response>) | null = null;
const netFetchMock = vi.fn();

vi.mock("electron", () => ({
    protocol: {
        handle: (_scheme: string, handler: (request: { url: string }) => Response | Promise<Response>) => {
            capturedHandler = handler;
        },
    },
    net: {
        fetch: (href: string) => netFetchMock(href),
    },
}));

vi.mock("electron-log/main", () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import { registerLocalFileProtocol } from "../local-file-protocol";

function buildRequest(filePath: string): { url: string } {
    // Mirror the URL shape the handler expects: `localfile://` + the path,
    // URL-encoded so spaces / non-ASCII survive the round-trip through
    // decodeURIComponent inside the handler.
    return { url: `localfile://${encodeURIComponent(filePath)}` };
}

describe("localfile:// protocol workspace boundary", () => {
    let workspace: string;

    beforeEach(() => {
        capturedHandler = null;
        netFetchMock.mockReset();
        netFetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
        workspace = join(tmpdir(), `pi-localfile-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        mkdirSync(workspace, { recursive: true });
    });

    afterEach(() => {
        rmSync(workspace, { recursive: true, force: true });
    });

    it("returns 403 when no active workspace is set", async () => {
        registerLocalFileProtocol({ getCurrentWorkspacePath: () => null });
        const handler = capturedHandler!;
        const res = await handler(buildRequest(join(workspace, "file.txt")));
        expect(res.status).toBe(403);
        expect(netFetchMock).not.toHaveBeenCalled();
    });

    it("returns 403 for paths outside the active workspace", async () => {
        registerLocalFileProtocol({ getCurrentWorkspacePath: () => workspace });
        const handler = capturedHandler!;
        const outside = join(tmpdir(), `pi-outside-${Date.now()}.txt`);
        const res = await handler(buildRequest(outside));
        expect(res.status).toBe(403);
        expect(netFetchMock).not.toHaveBeenCalled();
    });

    it("delegates to net.fetch for paths inside the active workspace", async () => {
        registerLocalFileProtocol({ getCurrentWorkspacePath: () => workspace });
        const handler = capturedHandler!;
        const inside = join(workspace, "notes.md");
        writeFileSync(inside, "hello", "utf-8");

        const res = await handler(buildRequest(inside));
        expect(res.status).toBe(200);
        expect(netFetchMock).toHaveBeenCalledTimes(1);
        // net.fetch should have been called with a file:// URL for the path.
        const fetchedHref = netFetchMock.mock.calls[0][0] as string;
        expect(fetchedHref.startsWith("file://")).toBe(true);
    });

    it("returns 403 for sensitive files even when inside the workspace", async () => {
        registerLocalFileProtocol({ getCurrentWorkspacePath: () => workspace });
        const handler = capturedHandler!;
        const sensitive = join(workspace, ".env");
        writeFileSync(sensitive, "SECRET=value", "utf-8");

        const res = await handler(buildRequest(sensitive));
        expect(res.status).toBe(403);
        expect(netFetchMock).not.toHaveBeenCalled();
    });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("child_process", () => ({
    execFile: vi.fn(),
}));

import { execFile } from "child_process";
import {
    clearPackageCatalogCacheForTest,
    fetchPackageCatalog,
    installPackage,
    parsePackageCatalog,
    parsePiList,
    removePackage,
    updatePackage,
} from "../pi-package-adapter";

beforeEach(() => {
    clearPackageCatalogCacheForTest();
    vi.unstubAllGlobals();
});

describe("parsePackageCatalog", () => {
    it("extracts package cards from pi.dev catalog html", () => {
        const html = `
          <a href="/packages/@jdiamond/pi-git" class="x" data-package-link="true" data-package-path="/packages/@jdiamond/pi-git">
            <strong>@jdiamond/pi-git</strong><span>Review-gated git tools.</span>
          </a>
          <a href="/packages/pi-web-access" class="x" data-package-link="true">
            <strong>pi-web-access</strong><span>Web access for Pi.</span>
          </a>
        `;
        const result = parsePackageCatalog(html);
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            name: "@jdiamond/pi-git",
            source: "npm:@jdiamond/pi-git",
            description: "Review-gated git tools.",
            installed: false,
        });
    });
});

describe("parsePiList", () => {
    it("returns empty when pi has no packages", () => {
        expect(parsePiList("No packages installed.\n")).toEqual([]);
    });

    it("extracts npm sources from mixed list output", () => {
        expect(parsePiList("Installed packages:\n- npm:@jdiamond/pi-git\n- npm:pi-web-access\n")).toEqual([
            { source: "npm:@jdiamond/pi-git", name: "@jdiamond/pi-git", enabled: true, scope: "global" },
            { source: "npm:pi-web-access", name: "pi-web-access", enabled: true, scope: "global" },
        ]);
    });
});

describe("fetchPackageCatalog", () => {
    it("caches the parsed catalog for repeated calls", async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            text: async () => `
              <a href="/packages/pi-web-access" data-package-link="true">
                <strong>pi-web-access</strong><span>Web access.</span>
              </a>
            `,
        }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(fetchPackageCatalog()).resolves.toHaveLength(1);
        await expect(fetchPackageCatalog()).resolves.toHaveLength(1);

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("reports catalog HTTP failures", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: false,
            status: 503,
            text: async () => "",
        })));

        await expect(fetchPackageCatalog()).rejects.toThrow("HTTP 503");
    });
});

describe("pi package actions", () => {
    it("installs npm sources globally by default", async () => {
        (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
            (_cmd: string, _args: string[], _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
                cb(null, "ok", "");
            },
        );
        await expect(installPackage("pi-web-access")).resolves.toMatchObject({
            success: true,
            requiresRestart: true,
        });
        const [cmd, args] = (execFile as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1) ?? [];
        if (process.platform === "win32") {
            const commandText = `${cmd} ${args.join(" ")}`;
            expect(commandText).not.toContain(" pi install ");
            expect(commandText).toMatch(/(cli\.js|pi\.cmd)/);
            expect(commandText).toContain("install");
            expect(commandText).toContain("npm:pi-web-access");
        } else {
            expect(cmd).toBe("pi");
            expect(args).toEqual(["install", "npm:pi-web-access"]);
        }
    });

    it("removes and updates by source", async () => {
        const calls: string[] = [];
        (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
            (_cmd: string, args: string[], _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
                calls.push(args.join(" "));
                cb(null, "ok", "");
            },
        );
        await removePackage("npm:pi-web-access");
        await updatePackage("npm:pi-web-access");
        expect(calls[0]).toContain("remove");
        expect(calls[0]).toContain("npm:pi-web-access");
        expect(calls[1]).toContain("update");
        expect(calls[1]).toContain("npm:pi-web-access");
    });
});

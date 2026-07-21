import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const { installSkillMock, uninstallSkillMock, searchSkillsMock } = vi.hoisted(() => ({
    installSkillMock: vi.fn(),
    uninstallSkillMock: vi.fn(),
    searchSkillsMock: vi.fn(),
}));

vi.mock("electron", () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers.set(channel, handler);
        }),
    },
}));

vi.mock("electron-log/main", () => ({
    default: {
        error: vi.fn(),
    },
}));

vi.mock("../../services/skills/skillhub-adapter", () => ({
    searchSkills: searchSkillsMock,
    listInstalled: vi.fn(async () => []),
    installSkill: installSkillMock,
    uninstallSkill: uninstallSkillMock,
    checkSkillhubInstalled: vi.fn(async () => true),
}));

import { setupSkillsIpc } from "../skills.ipc";

describe("setupSkillsIpc", () => {
    let stateDir: string;
    let stateFile: string;

    beforeEach(() => {
        handlers.clear();
        installSkillMock.mockReset();
        uninstallSkillMock.mockReset();
        searchSkillsMock.mockReset();
        stateDir = mkdtempSync(join(tmpdir(), "skills-ipc-"));
        stateFile = join(stateDir, "skills-state.json");
        setupSkillsIpc({
            getWorkspacePath: () => "C:/repo",
            getStateFile: () => stateFile,
        });
    });

    afterEach(() => {
        rmSync(stateDir, { recursive: true, force: true });
    });

    it("rejects invalid install slugs before invoking skillhub", async () => {
        const handler = handlers.get("skills:install")!;

        const result = await handler({}, "../escape");

        expect(result).toMatchObject({
            code: "ipcErrors.skills.invalidSlug",
        });
        expect(installSkillMock).not.toHaveBeenCalled();
    });

    it("installs valid slugs in the selected workspace", async () => {
        installSkillMock.mockResolvedValueOnce(undefined);
        const handler = handlers.get("skills:install")!;

        const result = await handler({}, "hello-world");

        expect(result).toEqual({ success: true });
        expect(installSkillMock).toHaveBeenCalledWith("hello-world", "C:/repo");
    });

    it("returns structured searchFailed when marketplace network errors (J-002)", async () => {
        searchSkillsMock.mockRejectedValueOnce(new Error("ENOTFOUND registry"));
        const handler = handlers.get("skills:search")!;
        const result = await handler({}, "hello");
        expect(result).toMatchObject({
            code: "ipcErrors.skills.searchFailed",
            fallback: expect.stringContaining("ENOTFOUND"),
        });
    });

    it("returns structured installFailed when skillhub install rejects (J-003)", async () => {
        installSkillMock.mockRejectedValueOnce(new Error("network 503"));
        const handler = handlers.get("skills:install")!;
        const result = await handler({}, "hello-world");
        expect(result).toMatchObject({
            code: "ipcErrors.skills.installFailed",
            fallback: expect.stringContaining("network 503"),
        });
    });

    describe("skills:toggle (J-004)", () => {
        it("rejects invalid slugs before touching state", async () => {
            const handler = handlers.get("skills:toggle")!;
            const result = await handler({}, "../escape", false);
            expect(result).toMatchObject({ code: "ipcErrors.skills.invalidSlug" });
        });

        it("disables a skill by appending its slug once", async () => {
            const handler = handlers.get("skills:toggle")!;
            expect(await handler({}, "hello-world", false)).toEqual({ success: true });
            expect(await handler({}, "hello-world", false)).toEqual({ success: true });

            const state = JSON.parse(readFileSync(stateFile, "utf8")) as { disabled: string[] };
            expect(state.disabled).toEqual(["hello-world"]);
        });

        it("re-enables a skill by removing it from disabled", async () => {
            writeFileSync(stateFile, JSON.stringify({ version: 1, disabled: ["hello-world", "other"] }), "utf8");
            const handler = handlers.get("skills:toggle")!;
            expect(await handler({}, "hello-world", true)).toEqual({ success: true });

            const state = JSON.parse(readFileSync(stateFile, "utf8")) as { disabled: string[] };
            expect(state.disabled).toEqual(["other"]);
        });

        it("serializes concurrent toggles without dropping updates", async () => {
            const handler = handlers.get("skills:toggle")!;
            await Promise.all([
                handler({}, "a", false),
                handler({}, "b", false),
                handler({}, "c", false),
            ]);
            const state = JSON.parse(readFileSync(stateFile, "utf8")) as { disabled: string[] };
            expect(state.disabled.sort()).toEqual(["a", "b", "c"]);
        });
    });
});

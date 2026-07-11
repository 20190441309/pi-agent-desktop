import type { ToolPermissions } from "@shared";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeToolPolicy } from "../runtime-policy";

const { originalExecutes } = vi.hoisted(() => ({
    originalExecutes: new Map<string, ReturnType<typeof vi.fn>>(),
}));

vi.mock("@earendil-works/pi-coding-agent", () => {
    const createDefinition = (name: string) => vi.fn(() => {
        const execute = vi.fn(async () => ({
            content: [{ type: "text", text: `${name}-result` }],
            details: { name },
        }));
        originalExecutes.set(name, execute);
        return {
            name,
            label: `${name} label`,
            description: `${name} description`,
            parameters: { type: "object", marker: name },
            renderCall: vi.fn(),
            renderResult: vi.fn(),
            execute,
        };
    });

    return {
        createReadToolDefinition: createDefinition("read"),
        createGrepToolDefinition: createDefinition("grep"),
        createFindToolDefinition: createDefinition("find"),
        createLsToolDefinition: createDefinition("ls"),
        createWriteToolDefinition: createDefinition("write"),
        createEditToolDefinition: createDefinition("edit"),
        createBashToolDefinition: createDefinition("bash"),
    };
});

import { createGuardedBuiltins, createRuntimePolicyController } from "../guarded-tools";

const allEnabled: ToolPermissions = {
    fileRead: true,
    fileWrite: true,
    shell: true,
    git: true,
    network: true,
    extensions: true,
};

function policy(overrides: Partial<ToolPermissions> = {}): RuntimeToolPolicy {
    return {
        mode: "build",
        permissions: { ...allEnabled, ...overrides },
        immutableDeniedTools: new Set(),
    };
}

async function execute(tool: ReturnType<typeof createGuardedBuiltins>[number], input: Record<string, unknown>) {
    return tool.execute("call-id", input as never, undefined, undefined, {} as never);
}

describe("createGuardedBuiltins", () => {
    let tempRoot: string;
    let workspace: string;
    let outside: string;

    beforeEach(async () => {
        originalExecutes.clear();
        tempRoot = await mkdtemp(join(tmpdir(), "pi-guarded-tools-"));
        workspace = join(tempRoot, "workspace");
        outside = join(tempRoot, "outside");
        await Promise.all([
            mkdir(workspace),
            mkdir(outside),
        ]);
    });

    afterEach(async () => {
        await rm(tempRoot, { recursive: true, force: true });
    });

    it("creates same-name overrides while preserving SDK metadata and results", async () => {
        await mkdir(join(workspace, "src"));
        await writeFile(join(workspace, "src", "index.ts"), "export {};\n");
        const tools = createGuardedBuiltins(workspace, () => policy());
        const read = tools.find((tool) => tool.name === "read");

        expect(tools.map((tool) => tool.name)).toEqual(["read", "grep", "find", "ls", "write", "edit", "bash"]);
        expect(read).toMatchObject({
            label: "read label",
            description: "read description",
            parameters: { type: "object", marker: "read" },
        });

        await expect(execute(read!, { path: "src/index.ts" })).resolves.toEqual({
            content: [{ type: "text", text: "read-result" }],
            details: { name: "read" },
        });
        expect(originalExecutes.get("read")).toHaveBeenCalledTimes(1);
    });

    it("captures a mutable policy getter and applies later updates", async () => {
        const controller = createRuntimePolicyController(policy());
        const read = createGuardedBuiltins(workspace, controller.getPolicy)
            .find((tool) => tool.name === "read")!;

        controller.setPolicy(policy({ fileRead: false }));

        await expect(execute(read, { path: "src/index.ts" })).rejects.toThrow(/read.*file read.*disabled/i);
        expect(originalExecutes.get("read")).not.toHaveBeenCalled();
    });

    it.each(["read", "grep", "find", "ls"])("denies %s when fileRead is disabled", async (name) => {
        const tool = createGuardedBuiltins(workspace, () => policy({ fileRead: false }))
            .find((candidate) => candidate.name === name)!;

        await expect(execute(tool, name === "read" ? { path: "file.ts" } : { path: "src" }))
            .rejects.toThrow(/file read.*disabled/i);
        expect(originalExecutes.get(name)).not.toHaveBeenCalled();
    });

    it.each(["write", "edit"])("denies %s when fileWrite is disabled", async (name) => {
        const tool = createGuardedBuiltins(workspace, () => policy({ fileWrite: false }))
            .find((candidate) => candidate.name === name)!;

        await expect(execute(tool, { path: "src/file.ts", content: "x", edits: [] }))
            .rejects.toThrow(/file write.*disabled/i);
        expect(originalExecutes.get(name)).not.toHaveBeenCalled();
    });

    it.each([
        ["read", "../outside.txt", /outside|工作区/i],
        ["write", ".env.local", /sensitive|敏感/i],
    ])("denies %s before execution for protected path %s", async (name, path, message) => {
        const tool = createGuardedBuiltins(workspace, () => policy())
            .find((candidate) => candidate.name === name)!;

        await expect(execute(tool, { path, content: "secret" })).rejects.toThrow(message);
        expect(originalExecutes.get(name)).not.toHaveBeenCalled();
    });

    it("denies reading an existing target through a workspace junction that points outside", async () => {
        await writeFile(join(outside, "public.txt"), "outside");
        await symlink(outside, join(workspace, "linked-directory"), process.platform === "win32" ? "junction" : "dir");
        const read = createGuardedBuiltins(workspace, () => policy())
            .find((tool) => tool.name === "read")!;

        await expect(execute(read, { path: join("linked-directory", "public.txt") }))
            .rejects.toThrow(/outside|工作区/i);
        expect(originalExecutes.get("read")).not.toHaveBeenCalled();
    });

    it("denies a nonexistent write target beneath a workspace junction that points outside", async () => {
        await symlink(outside, join(workspace, "linked-directory"), process.platform === "win32" ? "junction" : "dir");
        const write = createGuardedBuiltins(workspace, () => policy())
            .find((tool) => tool.name === "write")!;

        await expect(execute(write, {
            path: join("linked-directory", "new", "nested", "file.txt"),
            content: "secret",
        })).rejects.toThrow(/outside|工作区/i);
        expect(originalExecutes.get("write")).not.toHaveBeenCalled();
    });

    it("denies a harmlessly named directory junction to a protected credential directory", async () => {
        const credentialDirectory = join(workspace, ".ssh");
        await mkdir(credentialDirectory);
        await writeFile(join(credentialDirectory, "account.txt"), "credential");
        await symlink(
            credentialDirectory,
            join(workspace, "project-docs"),
            process.platform === "win32" ? "junction" : "dir",
        );
        const read = createGuardedBuiltins(workspace, () => policy())
            .find((tool) => tool.name === "read")!;

        await expect(execute(read, { path: join("project-docs", "account.txt") }))
            .rejects.toThrow(/sensitive|敏感/i);
        expect(originalExecutes.get("read")).not.toHaveBeenCalled();
    });

    it("denies a harmlessly named file symlink to a protected credential target", async (context) => {
        const credentialPath = join(workspace, ".env.local");
        await writeFile(credentialPath, "TOKEN=secret\n");
        try {
            await symlink(credentialPath, join(workspace, "notes.txt"), "file");
        } catch (error) {
            if (isErrorCode(error, "EPERM")) {
                context.skip();
                return;
            }
            throw error;
        }
        const read = createGuardedBuiltins(workspace, () => policy())
            .find((tool) => tool.name === "read")!;

        await expect(execute(read, { path: "notes.txt" })).rejects.toThrow(/sensitive|敏感/i);
        expect(originalExecutes.get("read")).not.toHaveBeenCalled();
    });

    it.each(["write", "edit"])("denies %s through a dangling link to a nonexistent outside target", async (name) => {
        const linkPath = join(workspace, "future-output.txt");
        let inputPath = "future-output.txt";
        try {
            await symlink(join(outside, "missing-output.txt"), linkPath, "file");
        } catch (error) {
            if (!isErrorCode(error, "EPERM")) throw error;

            await symlink(outside, linkPath, "junction");
            await rm(outside, { recursive: true, force: true });
            inputPath = join("future-output.txt", "missing-output.txt");
        }
        const tool = createGuardedBuiltins(workspace, () => policy())
            .find((candidate) => candidate.name === name)!;

        await expect(execute(tool, {
            path: inputPath,
            content: "outside",
            edits: [{ oldText: "before", newText: "after" }],
        })).rejects.toThrow(/outside|工作区/i);
        expect(originalExecutes.get(name)).not.toHaveBeenCalled();
    });

    it("denies bash before execution when runtime policy rejects the command", async () => {
        const bash = createGuardedBuiltins(workspace, () => policy({ shell: false }))
            .find((tool) => tool.name === "bash")!;

        await expect(execute(bash, { command: "pnpm test" })).rejects.toThrow(/shell commands are disabled/i);
        expect(originalExecutes.get("bash")).not.toHaveBeenCalled();
    });
});

function isErrorCode(error: unknown, code: string): boolean {
    return error instanceof Error && Reflect.get(error, "code") === code;
}

import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, describe, expect, it } from "vitest";
import { detectProject } from "./project-detector";

let root: string | null = null;

function makeRoot(): string {
    root = join(tmpdir(), `pi-project-detector-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(root, { recursive: true });
    return root;
}

afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = null;
});

describe("detectProject", () => {
    it("detects Node projects, package manager, metadata and scripts", () => {
        const dir = makeRoot();
        mkdirSync(join(dir, ".git"));
        writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: 9.0");
        writeFileSync(join(dir, "package.json"), JSON.stringify({
            name: "pi-workbench",
            version: "1.2.3",
            scripts: {
                test: "vitest",
                build: "tsc",
                ignored: 42,
            },
        }));

        expect(detectProject(dir)).toMatchObject({
            type: "node",
            name: "pi-workbench",
            version: "1.2.3",
            packageManager: "pnpm",
            hasGit: true,
            scripts: {
                test: "vitest",
                build: "tsc",
            },
        });
    });

    it("detects Python projects from pyproject and requirements", () => {
        const dir = makeRoot();
        writeFileSync(join(dir, "pyproject.toml"), "[project]\nname = \"demo\"");
        writeFileSync(join(dir, "requirements.txt"), "pytest\n");

        const result = detectProject(dir);

        expect(result.type).toBe("python");
        expect(result.packageManager).toBe("pip");
        expect(result.configFiles).toEqual(expect.arrayContaining(["pyproject.toml", "requirements.txt"]));
    });

    it("detects Rust project metadata from Cargo.toml", () => {
        const dir = makeRoot();
        writeFileSync(join(dir, "Cargo.toml"), "[package]\nname = \"pi-core\"\nversion = \"0.4.0\"\n[dependencies]\n");

        expect(detectProject(dir)).toMatchObject({
            type: "rust",
            name: "pi-core",
            version: "0.4.0",
            packageManager: "cargo",
        });
    });

    it("detects Go module names", () => {
        const dir = makeRoot();
        writeFileSync(join(dir, "go.mod"), "module github.com/acme/pi-agent\n\ngo 1.22\n");

        expect(detectProject(dir)).toMatchObject({
            type: "go",
            name: "pi-agent",
            packageManager: "go",
        });
    });

    it("detects Java build files and falls back for unknown projects", () => {
        const javaDir = makeRoot();
        writeFileSync(join(javaDir, "pom.xml"), "<project />");

        expect(detectProject(javaDir)).toMatchObject({
            type: "java",
            packageManager: undefined,
        });

        rmSync(javaDir, { recursive: true, force: true });
        root = null;
        const unknownDir = makeRoot();

        expect(detectProject(unknownDir)).toMatchObject({
            type: "unknown",
            configFiles: [],
            hasGit: false,
        });
    });
});

import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ensureComposeArtifactDirs, resolveComposeArtifactPaths } from "../artifact-paths";

describe("compose artifact paths", () => {
    it("resolves stable docs/compose artifact paths and creates the directories", () => {
        const cwd = mkdtempSync(join(tmpdir(), "compose-artifacts-"));
        try {
            const paths = resolveComposeArtifactPaths(cwd, {
                task: "Implement full Compose runtime",
            });
            ensureComposeArtifactDirs(paths);

            expect(paths.specPath).toMatch(/docs[\\/]compose[\\/]specs[\\/].+\.md$/);
            expect(paths.planPath).toMatch(/docs[\\/]compose[\\/]plans[\\/].+\.md$/);
            expect(paths.reportPath).toMatch(/docs[\\/]compose[\\/]reports[\\/].+\.md$/);
        } finally {
            rmSync(cwd, { recursive: true, force: true });
        }
    });
});

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ComposeArtifactPaths, ComposeWorkflowArgs } from "./types.ts";

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)
        .replace(/-+$/g, "") || "compose-run";
}

export function resolveComposeArtifactPaths(cwd: string, args: ComposeWorkflowArgs): ComposeArtifactPaths {
    const docsDir = join(cwd, "docs", "compose");
    const specsDir = join(docsDir, "specs");
    const plansDir = join(docsDir, "plans");
    const reportsDir = join(docsDir, "reports");
    const slug = slugify(args.featureName?.trim() || args.task);
    return {
        docsDir,
        specsDir,
        plansDir,
        reportsDir,
        slug,
        specPath: join(specsDir, `${slug}.md`),
        planPath: join(plansDir, `${slug}.md`),
        reportPath: join(reportsDir, `${slug}.md`),
    };
}

export function ensureComposeArtifactDirs(paths: ComposeArtifactPaths): void {
    mkdirSync(paths.specsDir, { recursive: true });
    mkdirSync(paths.plansDir, { recursive: true });
    mkdirSync(paths.reportsDir, { recursive: true });
}

import { join } from "path";
import { homedir } from "os";
import { describe, expect, it } from "vitest";
import { getProtectedPathReason, isPathInside } from "./protected-paths";

describe("protected path policy", () => {
    it("allows ordinary files inside the workspace", () => {
        const workspace = join(homedir(), "project");
        expect(getProtectedPathReason(join(workspace, "src", "app.ts"), workspace)).toBeNull();
    });

    it("blocks paths outside the workspace", () => {
        const workspace = join(homedir(), "project");
        expect(getProtectedPathReason(join(homedir(), "other", "secret.txt"), workspace)).toContain("不在当前工作区");
    });

    it("blocks sensitive credential directories and env files", () => {
        const workspace = join(homedir(), "project");
        expect(getProtectedPathReason(join(workspace, ".ssh", "id_ed25519"), workspace)).toContain("敏感凭据目录");
        expect(getProtectedPathReason(join(workspace, ".env.local"), workspace)).toContain("敏感配置");
    });

    it("blocks common token and credential files inside a workspace", () => {
        const workspace = join(homedir(), "project");
        expect(getProtectedPathReason(join(workspace, ".npmrc"), workspace)).toContain("敏感配置");
        expect(getProtectedPathReason(join(workspace, ".netrc"), workspace)).toContain("敏感配置");
        expect(getProtectedPathReason(join(workspace, "credentials.json"), workspace)).toContain("敏感配置");
        expect(getProtectedPathReason(join(workspace, "secrets.local"), workspace)).toContain("敏感配置");
        expect(getProtectedPathReason(join(workspace, "github-token.json"), workspace)).toContain("敏感配置");
    });

    it("blocks common cloud credential directories", () => {
        const workspace = join(homedir(), "project");
        expect(getProtectedPathReason(join(workspace, ".aws", "credentials"), workspace)).toContain("敏感凭据目录");
        expect(getProtectedPathReason(join(workspace, ".docker", "config.json"), workspace)).toContain("敏感凭据目录");
        expect(getProtectedPathReason(join(workspace, ".config", "gcloud", "application_default_credentials.json"), workspace)).toContain("敏感凭据目录");
    });

    it("checks parent/child path boundaries exactly", () => {
        const workspace = join(homedir(), "project");
        expect(isPathInside(workspace, join(workspace, "src", "app.ts"))).toBe(true);
        expect(isPathInside(workspace, `${workspace}-copy`)).toBe(false);
    });
});

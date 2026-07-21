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
        expect(getProtectedPathReason(join(workspace, ".gcloud", "credentials.db"), workspace)).toContain("敏感凭据目录");
    });

    it("blocks private keys, cert material, and local databases by extension", () => {
        const workspace = join(homedir(), "project");
        expect(getProtectedPathReason(join(workspace, "certs", "server.pem"), workspace)).toContain("敏感配置");
        expect(getProtectedPathReason(join(workspace, "keys", "app.key"), workspace)).toContain("敏感配置");
        expect(getProtectedPathReason(join(workspace, "auth.p12"), workspace)).toContain("敏感配置");
        expect(getProtectedPathReason(join(workspace, "data", "sessions.sqlite"), workspace)).toContain("敏感配置");
        expect(getProtectedPathReason(join(workspace, "state.db"), workspace)).toContain("敏感配置");
        expect(getProtectedPathReason(join(workspace, "id_ed25519.pub"), workspace)).toContain("敏感配置");
        expect(getProtectedPathReason(join(workspace, "authorized_keys"), workspace)).toContain("敏感配置");
    });

    it("still applies sensitive-name filters when workspacePath is omitted", () => {
        // shell:open-path / shell:reveal-path may omit workspacePath; sensitive files
        // must still be blocked even without a workspace boundary check.
        expect(getProtectedPathReason(join(homedir(), "Downloads", ".env"))).toContain("敏感配置");
        expect(getProtectedPathReason(join(homedir(), "Downloads", "token.json"))).toContain("敏感配置");
        expect(getProtectedPathReason(join(homedir(), "Downloads", "notes.pem"))).toContain("敏感配置");
        expect(getProtectedPathReason(join(homedir(), "Downloads", "cache.sqlite"))).toContain("敏感配置");
        // Ordinary non-sensitive paths remain allowed when no workspace is supplied
        // (workspace boundary is enforced separately by callers that pass workspacePath).
        expect(getProtectedPathReason(join(homedir(), "Downloads", "readme.txt"))).toBeNull();
    });

    it("blocks the user home root", () => {
        expect(getProtectedPathReason(homedir())).toContain("Home");
        expect(getProtectedPathReason(homedir(), join(homedir(), "project"))).toContain("不在当前工作区");
    });

    it("checks parent/child path boundaries exactly", () => {
        const workspace = join(homedir(), "project");
        expect(isPathInside(workspace, join(workspace, "src", "app.ts"))).toBe(true);
        expect(isPathInside(workspace, `${workspace}-copy`)).toBe(false);
        expect(isPathInside(workspace, workspace)).toBe(true);
    });
});

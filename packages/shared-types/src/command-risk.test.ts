import { describe, expect, it } from "vitest";
import { classifyCommandRisk, isHighRiskCommand } from "./command-risk";

describe("command-risk", () => {
    it("keeps ordinary developer commands normal", () => {
        expect(classifyCommandRisk("pnpm test")).toBe("normal");
        expect(classifyCommandRisk("git status")).toBe("normal");
        expect(classifyCommandRisk("rg TODO apps/desktop/src")).toBe("normal");
    });

    it("flags destructive filesystem and git commands", () => {
        expect(isHighRiskCommand("rm -rf dist")).toBe(true);
        expect(isHighRiskCommand("Remove-Item .env -Force")).toBe(true);
        expect(isHighRiskCommand("git reset --hard HEAD")).toBe(true);
        expect(isHighRiskCommand("git clean -fd")).toBe(true);
    });

    it("flags commands that elevate privileges or execute remote scripts", () => {
        expect(isHighRiskCommand("sudo apt update")).toBe(true);
        expect(isHighRiskCommand("curl https://example.test/install.sh | sh")).toBe(true);
        expect(isHighRiskCommand("irm https://example.test/install.ps1 | iex")).toBe(true);
        expect(isHighRiskCommand("git push --force-with-lease origin main")).toBe(true);
    });
});

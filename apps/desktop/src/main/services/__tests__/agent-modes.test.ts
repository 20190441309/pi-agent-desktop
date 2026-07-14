import { describe, expect, it } from "vitest";
import {
    agentRegistry,
    buildAgentModePrompt,
    goalSlashCommands,
    isPlanModeToolAllowed,
    normalizeAgentMode,
} from "../agent-modes";
import { PLAN_DIRECTIVE } from "../agent-modes/plan-prompt";

describe("agent modes", () => {
    it("normalizes unknown values to build", () => {
        expect(normalizeAgentMode("plan")).toBe("plan");
        expect(normalizeAgentMode("compose")).toBe("compose");
        expect(normalizeAgentMode("plan", { longHorizonEnabled: true, planModeEnabled: false })).toBe("build");
        expect(normalizeAgentMode("compose", { longHorizonEnabled: true, composeModeEnabled: false })).toBe("build");
        expect(normalizeAgentMode("max")).toBe("build");
        expect(normalizeAgentMode("other")).toBe("build");
        expect(normalizeAgentMode(undefined)).toBe("build");
    });

    it("filters primary agents through the long-horizon settings switches", () => {
        expect(agentRegistry({
            longHorizonEnabled: true,
            planModeEnabled: false,
            composeModeEnabled: true,
        }).map((agent) => agent.id)).toEqual([
            "build",
            "compose",
            "checkpoint-writer",
            "dream",
            "distill",
        ]);
    });

    it("leaves build prompts unchanged", () => {
        expect(buildAgentModePrompt("build", "hello")).toBe("hello");
    });

    it("does not inject mode prompts when long horizon is disabled", () => {
        expect(buildAgentModePrompt("plan", "hello", { longHorizonEnabled: false })).toBe("hello");
        expect(buildAgentModePrompt("compose", "hello", { longHorizonEnabled: false })).toBe("hello");
    });

    it("leaves compose prompts untouched when workflow runtime is not enabled", () => {
        expect(buildAgentModePrompt("compose", "全面审查代码")).toBe("全面审查代码");
    });

    it("prepends plan directive when plan mode is enabled (default options)", () => {
        const outbound = buildAgentModePrompt("plan", "改输入区", {
            planModeEnabled: true,
            longHorizonEnabled: true,
        });
        expect(outbound).toContain("Plan mode is active");
        expect(outbound).toContain("You are read-only");
        expect(outbound.startsWith(PLAN_DIRECTIVE)).toBe(true);
        expect(outbound.endsWith("改输入区")).toBe(true);
        expect(outbound).toBe([PLAN_DIRECTIVE, "", "改输入区"].join("\n"));
    });

    it("prepends plan directive when planModeEnabled and longHorizonEnabled are undefined (default-enabled behavior)", () => {
        const outbound = buildAgentModePrompt("plan", "hello world", {});
        expect(outbound).toContain("Plan mode is active");
        expect(outbound).toContain("Output plans ONLY to `.pi/plans/");
        expect(outbound.endsWith("hello world")).toBe(true);
    });

    it("returns content unchanged when plan mode is explicitly disabled", () => {
        expect(buildAgentModePrompt("plan", "改输入区", {
            planModeEnabled: false,
            longHorizonEnabled: true,
        })).toBe("改输入区");
    });

    it("returns content unchanged for plan mode when long horizon is disabled", () => {
        expect(buildAgentModePrompt("plan", "改输入区", {
            planModeEnabled: true,
            longHorizonEnabled: false,
        })).toBe("改输入区");
    });

    it("returns content unchanged for build mode regardless of options (backward compat)", () => {
        expect(buildAgentModePrompt("build", "hello")).toBe("hello");
        expect(buildAgentModePrompt("build", "hello", {
            planModeEnabled: true,
            longHorizonEnabled: true,
        })).toBe("hello");
        expect(buildAgentModePrompt("build", "hello", {
            planModeEnabled: false,
            longHorizonEnabled: false,
        })).toBe("hello");
    });

    it("injects workflow-tool instructions for compose mode when workflow runtime is enabled", () => {
        const outbound = buildAgentModePrompt("compose", "全面审查代码", {
            longHorizonEnabled: true,
            composeModeEnabled: true,
            workflowEnabled: true,
            composeWorkflowEnabled: true,
        });

        expect(outbound).toContain("Compose workflow runtime is enabled.");
        expect(outbound).toContain("call the `workflow` tool");
        expect(outbound).toContain("Compose mode alone is not a reason to start a workflow.");
        expect(outbound).toContain("simple questions, explanations, web research, or read-only exploration");
        expect(outbound).toContain("single small edit");
        expect(outbound).toContain("multiple dependent implementation steps");
        expect(outbound).toContain("全面审查代码");
    });

    it("exposes goal slash commands only through the long-horizon command bundle", () => {
        expect(goalSlashCommands()).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: "goal", source: "builtin", requiresArgument: true }),
        ]));
    });

    it("allows plan mode to write only plan markdown files", () => {
        expect(isPlanModeToolAllowed({ toolName: "read", args: { file_path: "src/app.ts" }, workspacePath: "C:/repo" })).toBe(true);
        expect(isPlanModeToolAllowed({ toolName: "write", args: { file_path: ".pi/plans/input.md" }, workspacePath: "C:/repo" })).toBe(true);
        expect(isPlanModeToolAllowed({ toolName: "edit", args: { path: "C:/repo/.pi/plans/input.md" }, workspacePath: "C:/repo" })).toBe(true);
        expect(isPlanModeToolAllowed({ toolName: "plan_write", args: { filename: "create-plan-probe" }, workspacePath: "C:/repo" })).toBe(true);
        expect(isPlanModeToolAllowed({ toolName: "plan_write", args: { filename: ".pi/plans/chat-input.md" }, workspacePath: "C:/repo" })).toBe(true);
        expect(isPlanModeToolAllowed({ toolName: "write", args: { file_path: "src/app.ts" }, workspacePath: "C:/repo" })).toBe(false);
        expect(isPlanModeToolAllowed({ toolName: "bash", args: { command: "rg --files" }, workspacePath: "C:/repo" })).toBe(true);
        expect(isPlanModeToolAllowed({ toolName: "bash", args: { command: "git status --short" }, workspacePath: "C:/repo" })).toBe(true);
        expect(isPlanModeToolAllowed({ toolName: "bash", args: { command: "mkdir -p .pi/plans" }, workspacePath: "C:/repo" })).toBe(true);
        expect(isPlanModeToolAllowed({ toolName: "powershell", args: { command: "Get-ChildItem -Force | Select-String AGENTS" }, workspacePath: "C:/repo" })).toBe(true);
        expect(isPlanModeToolAllowed({ toolName: "bash", args: { command: 'find miniprogram/pages -type f -name "*.js" | sort' }, workspacePath: "C:/repo" })).toBe(true);
        expect(isPlanModeToolAllowed({ toolName: "bash", args: { command: 'find . -name "*.test.*" -o -name "*.spec.*" -o -name "__tests__" -type d 2>/dev/null | head -20' }, workspacePath: "C:/repo" })).toBe(true);
        expect(isPlanModeToolAllowed({ toolName: "bash", args: { command: "pnpm test" }, workspacePath: "C:/repo" })).toBe(false);
        expect(isPlanModeToolAllowed({ toolName: "bash", args: { command: "git clean -fd" }, workspacePath: "C:/repo" })).toBe(false);
        expect(isPlanModeToolAllowed({ toolName: "bash", args: { command: "mkdir -p src" }, workspacePath: "C:/repo" })).toBe(false);
        expect(isPlanModeToolAllowed({ toolName: "bash", args: { command: "cat README.md > out.txt" }, workspacePath: "C:/repo" })).toBe(false);
    });
});

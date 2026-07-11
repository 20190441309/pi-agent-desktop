import type { AgentMode } from "@shared";

export type ToolCategory = "fileRead" | "fileWrite" | "shell" | "network" | "extension";

const FILE_READ_TOOLS = new Set(["read", "grep", "find", "ls", "glob", "list"]);
const FILE_WRITE_TOOLS = new Set(["write", "edit", "apply_patch", "multiedit"]);
const SHELL_TOOLS = new Set(["bash", "shell"]);
const NETWORK_TOOLS = new Set(["webfetch", "websearch", "fetch", "http"]);
const CORE_TOOLS = new Set(["read", "grep", "find", "ls", "glob", "list", "write", "edit", "bash"]);

export function normalizeToolName(name: string): string {
    return name.trim().toLowerCase();
}

export function classifyToolName(name: string): ToolCategory {
    const normalized = normalizeToolName(name);
    if (FILE_READ_TOOLS.has(normalized)) return "fileRead";
    if (FILE_WRITE_TOOLS.has(normalized)) return "fileWrite";
    if (SHELL_TOOLS.has(normalized)) return "shell";
    if (NETWORK_TOOLS.has(normalized) || /(?:web|http|fetch)/i.test(normalized)) return "network";
    return "extension";
}

export function isCoreTool(name: string): boolean {
    return CORE_TOOLS.has(normalizeToolName(name));
}

export function isModeRequiredTool(name: string, mode: AgentMode): boolean {
    return mode === "plan" && normalizeToolName(name) === "plan_write";
}

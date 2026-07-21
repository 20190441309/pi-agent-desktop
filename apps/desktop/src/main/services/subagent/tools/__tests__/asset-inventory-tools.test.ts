import { describe, expect, it, vi } from "vitest";
import { createAssetInventoryTools } from "../asset-inventory-tools";
import type { ResourceLoader } from "@earendil-works/pi-coding-agent";

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
}

async function exec(tool: { execute: (...args: never[]) => Promise<unknown> }) {
  return tool.execute(
    "call-1" as never,
    {} as never,
    undefined as never,
    undefined as never,
    {} as never,
  ) as Promise<{ content: Array<{ type: string; text?: string }>; details: unknown }>;
}

function mockLoader(partial: {
  skills?: Array<{
    name: string;
    description: string;
    filePath: string;
    disableModelInvocation: boolean;
  }>;
  commands?: Map<string, { description?: string }>;
  extPath?: string;
  agentsFiles?: Array<{ path: string; content: string }>;
}): ResourceLoader {
  return {
    getSkills: () => ({ skills: partial.skills ?? [] }),
    getExtensions: () => ({
      extensions: [
        {
          path: partial.extPath ?? "/ext/a",
          commands: partial.commands ?? new Map(),
        },
      ],
    }),
    getAgentsFiles: () => ({ agentsFiles: partial.agentsFiles ?? [] }),
  } as unknown as ResourceLoader;
}

describe("createAssetInventoryTools", () => {
  it("exposes skill/command/agent list tools", () => {
    const tools = createAssetInventoryTools(mockLoader({}));
    expect(tools.map((t) => t.name)).toEqual(["skill_list", "command_list", "agent_list"]);
  });

  it("formats empty and populated skill lists", async () => {
    const [skillList] = createAssetInventoryTools(mockLoader({ skills: [] }));
    expect(textOf(await exec(skillList))).toBe("No skills installed.");

    const [skillList2] = createAssetInventoryTools(
      mockLoader({
        skills: [
          {
            name: "demo",
            description: "Demo skill",
            filePath: "/s/demo",
            disableModelInvocation: true,
          },
          {
            name: "other",
            description: "Other",
            filePath: "/s/other",
            disableModelInvocation: false,
          },
        ],
      }),
    );
    const body = textOf(await exec(skillList2));
    expect(body).toContain("Found 2 skill(s):");
    expect(body).toContain("- demo (no-model-invocation): Demo skill");
    expect(body).toContain("- other: Other");
  });

  it("formats and sorts slash commands", async () => {
    const commands = new Map<string, { description?: string }>([
      ["zeta", { description: "last" }],
      ["alpha", {}],
    ]);
    const [, commandList] = createAssetInventoryTools(
      mockLoader({ commands, extPath: "/ext/x" }),
    );
    const empty = createAssetInventoryTools(mockLoader({ commands: new Map() }))[1];
    expect(textOf(await exec(empty))).toBe("No commands registered.");

    const body = textOf(await exec(commandList));
    expect(body).toContain("Found 2 command(s):");
    const alphaAt = body.indexOf("/alpha");
    const zetaAt = body.indexOf("/zeta: last");
    expect(alphaAt).toBeGreaterThan(-1);
    expect(zetaAt).toBeGreaterThan(alphaAt);
  });

  it("formats agent files with multi-line preview (first 3 lines) and truncates details", async () => {
    const long = "line1\nline2\nline3\nline4\n" + "x".repeat(600);
    const [, , agentList] = createAssetInventoryTools(
      mockLoader({
        agentsFiles: [
          { path: "/.pi/agents/a.md", content: long },
          { path: "/.pi/agents/b.md", content: "short" },
        ],
      }),
    );
    const empty = createAssetInventoryTools(mockLoader({ agentsFiles: [] }))[2];
    expect(textOf(await exec(empty))).toBe("No agent files discovered.");

    const result = await exec(agentList);
    const body = textOf(result);
    expect(body).toContain("Found 2 agent file(s):");
    expect(body).toContain("/.pi/agents/a.md");
    // formatAgentFiles only surfaces the first 3 preview lines in text
    expect(body).toContain("line1 / line2 / line3");
    expect(body).not.toContain("line4");
    expect(body).toContain("short");
    const details = result.details as {
      agents: Array<{ path: string; preview: string }>;
    };
    expect(details.agents[0].preview.endsWith("...")).toBe(true);
    expect(details.agents[0].preview.length).toBe(503); // PREVIEW_MAX 500 + "..."
  });
});

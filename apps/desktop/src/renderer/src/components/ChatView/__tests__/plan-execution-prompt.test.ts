import { describe, expect, it } from "vitest";
import { stripPlanFrontmatter } from "../plan-utils";
import { buildPlanExecutionPrompt } from "../plan-execution-prompt";

describe("stripPlanFrontmatter (plan-utils)", () => {
  it("removes YAML frontmatter when present", () => {
    const raw = "---\ntitle: x\nstatus: draft\n---\n# Goal\nDo the thing\n";
    expect(stripPlanFrontmatter(raw)).toBe("# Goal\nDo the thing");
  });

  it("returns content unchanged without frontmatter", () => {
    expect(stripPlanFrontmatter("# Plan\nstep 1")).toBe("# Plan\nstep 1");
  });
});

describe("buildPlanExecutionPrompt", () => {
  it("includes title, filename, option, and body without frontmatter", () => {
    const outbound = buildPlanExecutionPrompt({
      title: "写 probe",
      filename: "plan-abc.md",
      selectedOption: "A",
      content: "---\ntitle: t\n---\n1. write plan_probe.txt\n2. verify PLAN_OK\n",
    });
    expect(outbound).toContain("请直接执行下面这份计划，不要重新生成计划。");
    expect(outbound).toContain("计划标题：写 probe");
    expect(outbound).toContain("计划文件：plan-abc.md");
    expect(outbound).toContain("已选择执行方案：A");
    expect(outbound).toContain("1. write plan_probe.txt");
    expect(outbound).toContain("[PLAN_DONE]");
    expect(outbound).toContain("[DONE:n]");
    expect(outbound).not.toContain("title: t");
  });

  it("omits filename and option lines when absent", () => {
    const outbound = buildPlanExecutionPrompt({
      title: "简单计划",
      content: "step one",
    });
    expect(outbound).toContain("计划标题：简单计划");
    expect(outbound).not.toContain("计划文件：");
    expect(outbound).not.toContain("已选择执行方案：");
    expect(outbound).toContain("step one");
  });

  it("falls back body when content empty after strip", () => {
    const outbound = buildPlanExecutionPrompt({
      title: "空",
      content: "---\nx: 1\n---\n   \n",
    });
    expect(outbound).toContain("执行当前计划。");
  });
});

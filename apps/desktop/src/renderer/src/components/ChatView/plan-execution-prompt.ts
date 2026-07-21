/**
 * Build the user-visible outbound prompt when the user clicks「执行计划」.
 * Kept pure so unit tests can lock the contract without mounting ChatView.
 */
import { stripPlanFrontmatter } from "./plan-utils";

export function buildPlanExecutionPrompt(input: {
  title: string;
  filename?: string;
  selectedOption?: string;
  content: string;
}): string {
  const planContent = stripPlanFrontmatter(input.content).trim();
  return [
    "请直接执行下面这份计划，不要重新生成计划。",
    `计划标题：${input.title}`,
    input.filename ? `计划文件：${input.filename}` : undefined,
    input.selectedOption ? `已选择执行方案：${input.selectedOption}` : undefined,
    "",
    "执行要求：",
    "1. 严格按顺序实施并验证每个步骤。",
    "2. 每完成一个主要步骤，就输出一个 [DONE:n] 标记，n 从 1 开始递增。",
    "3. 如果遇到阻塞，只说明阻塞点和原因，不要假装完成。",
    "4. 完成全部步骤后，再用简短中文总结结果。",
    "5. 只有全部步骤都完成时，先单独输出一行 [PLAN_DONE]，再输出最终中文总结。",
    "",
    "计划内容：",
    planContent || "执行当前计划。",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

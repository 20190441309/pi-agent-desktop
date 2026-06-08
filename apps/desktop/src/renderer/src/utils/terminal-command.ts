import { isHighRiskCommand } from "@shared/command-risk";

export type TerminalCommandMode = "run" | "draft";

export function classifyTerminalCommand(command: string): TerminalCommandMode {
  return isHighRiskCommand(command) ? "draft" : "run";
}

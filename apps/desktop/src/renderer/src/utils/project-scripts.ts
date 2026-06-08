import type { ProjectInfo } from "@shared";

export function projectScriptCommand(packageManager: ProjectInfo["packageManager"], scriptName: string): string {
  if (packageManager === "yarn") return `yarn ${scriptName}`;
  if (packageManager === "bun") return `bun run ${scriptName}`;
  if (packageManager === "pnpm") return `pnpm ${scriptName}`;
  return `npm run ${scriptName}`;
}

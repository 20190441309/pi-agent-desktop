import { describe, expect, it } from "vitest";
import { projectScriptCommand } from "./project-scripts";

describe("projectScriptCommand", () => {
  it("formats yarn without run", () => {
    expect(projectScriptCommand("yarn", "dev")).toBe("yarn dev");
  });

  it("formats bun with run", () => {
    expect(projectScriptCommand("bun", "test")).toBe("bun run test");
  });

  it("formats pnpm without run", () => {
    expect(projectScriptCommand("pnpm", "lint")).toBe("pnpm lint");
  });

  it("defaults npm with run for npm and unknown managers", () => {
    expect(projectScriptCommand("npm", "build")).toBe("npm run build");
    expect(projectScriptCommand(undefined, "start")).toBe("npm run start");
    expect(projectScriptCommand("unknown" as "npm", "start")).toBe("npm run start");
  });
});

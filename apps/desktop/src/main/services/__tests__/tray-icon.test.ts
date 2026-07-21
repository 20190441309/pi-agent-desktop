import { describe, expect, it } from "vitest";
import { join } from "path";
import { resolveTrayIconPath } from "../tray-icon";

const isMac = process.platform === "darwin";
const iconExt = isMac ? "png" : "ico";

describe("resolveTrayIconPath", () => {
  it("prefers the packaged extraResources icon before dev fallbacks", () => {
    const expectedPath = join("C:\\dist\\resources", "build", `icon.${iconExt}`);
    const existing = new Set([
      expectedPath,
      join("C:\\dist", "build", `icon.${iconExt}`),
    ]);

    const result = resolveTrayIconPath({
      appPath: "C:\\dist\\resources\\app.asar",
      cwd: "C:\\dist",
      resourcesPath: "C:\\dist\\resources",
      exists: (candidate) => existing.has(candidate),
    });

    expect(result.path).toBe(expectedPath);
    expect(result.checkedPaths[0]).toBe(expectedPath);
  });

  it("returns null when no tray icon asset exists", () => {
    const result = resolveTrayIconPath({
      appPath: "C:\\dist\\resources\\app.asar",
      cwd: "C:\\dist",
      resourcesPath: "C:\\dist\\resources",
      exists: () => false,
    });

    expect(result.path).toBeNull();
    expect(result.checkedPaths).not.toContain("C:\\dist\\Pi Desktop.exe");
  });
});



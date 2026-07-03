import { describe, expect, it } from "vitest";
import { resolveTrayIconPath } from "../tray-icon";

describe("resolveTrayIconPath", () => {
  it("prefers the packaged extraResources icon before dev fallbacks", () => {
    const existing = new Set([
      "C:\\dist\\resources\\build\\icon.ico",
      "C:\\dist\\build\\icon.ico",
    ]);

    const result = resolveTrayIconPath({
      appPath: "C:\\dist\\resources\\app.asar",
      cwd: "C:\\dist",
      resourcesPath: "C:\\dist\\resources",
      exists: (candidate) => existing.has(candidate),
    });

    expect(result.path).toBe("C:\\dist\\resources\\build\\icon.ico");
    expect(result.checkedPaths[0]).toBe("C:\\dist\\resources\\build\\icon.ico");
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

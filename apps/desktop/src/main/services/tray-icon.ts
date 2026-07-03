import { existsSync } from "fs";
import { join, resolve } from "path";

export interface TrayIconPathResolverOptions {
  appPath: string;
  cwd: string;
  resourcesPath: string;
  exists?: (path: string) => boolean;
}

export interface TrayIconPathResolution {
  path: string | null;
  checkedPaths: string[];
}

export function resolveTrayIconPath(options: TrayIconPathResolverOptions): TrayIconPathResolution {
  const exists = options.exists ?? existsSync;
  const checkedPaths = [
    join(options.resourcesPath, "build", "icon.ico"),
    join(options.resourcesPath, "app.asar.unpacked", "build", "icon.ico"),
    join(options.appPath, "build", "icon.ico"),
    resolve(options.appPath, "..", "build", "icon.ico"),
    resolve(options.appPath, "..", "..", "build", "icon.ico"),
    join(options.cwd, "build", "icon.ico"),
  ];

  return {
    path: checkedPaths.find((candidate) => exists(candidate)) ?? null,
    checkedPaths,
  };
}

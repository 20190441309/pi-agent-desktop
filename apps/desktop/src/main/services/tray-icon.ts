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
  const isMac = process.platform === 'darwin';
  const iconFile = isMac ? 'icon.png' : 'icon.ico';

  const checkedPaths = [
    join(options.resourcesPath, "build", iconFile),
    join(options.resourcesPath, "app.asar.unpacked", "build", iconFile),
    join(options.appPath, "build", iconFile),
    resolve(options.appPath, "..", "build", iconFile),
    resolve(options.appPath, "..", "..", "build", iconFile),
    join(options.cwd, "build", iconFile),
  ];

  return {
    path: checkedPaths.find((candidate) => exists(candidate)) ?? null,
    checkedPaths,
  };
}

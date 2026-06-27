import { join } from "path";

const DEFAULT_ELECTRON_BINARY = process.platform === "win32" ? "electron.exe" : "electron";

export function resolveElectronExecutablePath(): string | undefined {
    const explicitPath = process.env.PI_DESKTOP_ELECTRON_EXECUTABLE_PATH?.trim();
    if (explicitPath) return explicitPath;

    const overrideDistPath = process.env.ELECTRON_OVERRIDE_DIST_PATH?.trim();
    if (!overrideDistPath) return undefined;

    return join(overrideDistPath, DEFAULT_ELECTRON_BINARY);
}

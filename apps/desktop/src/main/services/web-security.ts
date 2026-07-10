import { shell, type BrowserWindow } from "electron";
import { is } from "@electron-toolkit/utils";
import log from "electron-log/main";
import { normalize } from "node:path";
import { fileURLToPath } from "node:url";

export function isAllowedExternalUrl(url: string): boolean {
  try {
    const target = new URL(url);
    return target.protocol === "http:" || target.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizedFilePath(url: URL): string | null {
  try {
    const path = normalize(fileURLToPath(url));
    return process.platform === "win32" ? path.toLowerCase() : path;
  } catch {
    return null;
  }
}

export function isAllowedNavigationUrl(
  targetUrl: string,
  currentUrl: string,
  allowDevLocalhost = is.dev,
): boolean {
  let target: URL;
  let current: URL;
  try {
    target = new URL(targetUrl);
    current = new URL(currentUrl);
  } catch {
    return false;
  }

  if (target.protocol === "file:" || current.protocol === "file:") {
    if (target.protocol !== "file:" || current.protocol !== "file:") return false;
    const targetPath = normalizedFilePath(target);
    const currentPath = normalizedFilePath(current);
    return targetPath !== null && currentPath !== null && targetPath === currentPath;
  }

  if (
    (target.protocol === "http:" || target.protocol === "https:") &&
    (current.protocol === "http:" || current.protocol === "https:") &&
    target.origin === current.origin
  ) {
    return true;
  }

  return Boolean(
    allowDevLocalhost &&
    (target.protocol === "http:" || target.protocol === "https:") &&
    (target.hostname === "localhost" || target.hostname === "127.0.0.1"),
  );
}

export function attachWebSecurityHandlers(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url).catch((error) => {
        log.warn("[web-security] shell.openExternal failed:", url, error);
      });
    } else {
      log.warn("[web-security] blocked external URL:", url);
    }
    return { action: "deny" };
  });

  const blockUnsafeNavigation = (event: { preventDefault: () => void }, url: string): void => {
    if (!isAllowedNavigationUrl(url, win.webContents.getURL())) {
      log.warn("[web-security] blocked navigation:", url);
      event.preventDefault();
    }
  };
  win.webContents.on("will-navigate", blockUnsafeNavigation);
  win.webContents.on("will-redirect", blockUnsafeNavigation);
}

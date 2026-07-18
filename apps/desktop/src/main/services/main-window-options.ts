import type { BrowserWindowConstructorOptions } from "electron";

type MainWindowChromeOptions = Pick<
  BrowserWindowConstructorOptions,
  "backgroundColor" | "frame" | "titleBarStyle" | "transparent"
>;

export function resolveMainWindowChromeOptions(platform: NodeJS.Platform): MainWindowChromeOptions {
  const opaqueSurface = {
    backgroundColor: "#f4f4f4",
    transparent: false,
  } as const;

  if (platform === "darwin") {
    return {
      ...opaqueSurface,
      frame: true,
      titleBarStyle: "hiddenInset",
    };
  }

  return {
    ...opaqueSurface,
    frame: false,
  };
}

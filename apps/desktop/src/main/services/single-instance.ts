interface SingleInstanceApp {
  requestSingleInstanceLock(): boolean;
  on(event: "second-instance", listener: () => void): unknown;
  quit(): void;
  exit(exitCode?: number): void;
}

export function registerSingleInstance(
  app: SingleInstanceApp,
  restoreExistingWindow: () => void,
): boolean {
  const isPrimaryInstance = app.requestSingleInstanceLock();
  if (!isPrimaryInstance) {
    app.exit(0);
    return false;
  }

  app.on("second-instance", restoreExistingWindow);
  return true;
}

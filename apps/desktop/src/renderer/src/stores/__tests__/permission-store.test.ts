import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionUiRequest } from "@shared";
import {
  cleanupPermissionSubscriptions,
  ensurePermissionSubscriptions,
  usePermissionStore,
} from "../permission-store";

function req(id: string): ExtensionUiRequest {
  return {
    requestId: id,
    kind: "confirm",
    source: "permission",
    title: `Approve ${id}`,
    message: "run tool?",
    createdAt: Date.now(),
  };
}

describe("permission-store", () => {
  beforeEach(() => {
    cleanupPermissionSubscriptions();
    usePermissionStore.setState({ mode: "smart", pending: [] });
    vi.unstubAllGlobals();
  });

  it("setMode updates local state and calls piAPI", () => {
    const permissionSetMode = vi.fn(async () => undefined);
    vi.stubGlobal("window", { piAPI: { permissionSetMode } });
    usePermissionStore.getState().setMode("ask");
    expect(usePermissionStore.getState().mode).toBe("ask");
    expect(permissionSetMode).toHaveBeenCalledWith("ask");
  });

  it("enqueue dedupes by requestId", () => {
    usePermissionStore.getState().enqueue(req("r1"));
    usePermissionStore.getState().enqueue(req("r1"));
    usePermissionStore.getState().enqueue(req("r2"));
    expect(usePermissionStore.getState().pending.map((p) => p.requestId)).toEqual(["r1", "r2"]);
  });

  it("respond sends decision and dismisses", () => {
    const permissionRespond = vi.fn();
    vi.stubGlobal("window", { piAPI: { permissionRespond } });
    usePermissionStore.getState().enqueue(req("r1"));
    usePermissionStore.getState().respond("r1", "allow_once");
    expect(permissionRespond).toHaveBeenCalledWith("r1", {
      requestId: "r1",
      decision: "allow_once",
    });
    expect(usePermissionStore.getState().pending).toEqual([]);
  });

  it("respondValue sends value and dismisses", () => {
    const permissionRespond = vi.fn();
    vi.stubGlobal("window", { piAPI: { permissionRespond } });
    usePermissionStore.getState().enqueue(req("r9"));
    usePermissionStore.getState().respondValue("r9", "yes");
    expect(permissionRespond).toHaveBeenCalledWith("r9", { requestId: "r9", value: "yes" });
    expect(usePermissionStore.getState().pending).toEqual([]);
  });

  it("respond no-ops for unknown request ids", () => {
    const permissionRespond = vi.fn();
    vi.stubGlobal("window", { piAPI: { permissionRespond } });
    usePermissionStore.getState().respond("missing", "deny");
    expect(permissionRespond).not.toHaveBeenCalled();
  });

  it("ensurePermissionSubscriptions enqueues pushed requests once", () => {
    const handlers: Array<(request: ExtensionUiRequest) => void> = [];
    const off = vi.fn();
    vi.stubGlobal("window", {
      piAPI: {
        onPermissionRequest: (handler: (request: ExtensionUiRequest) => void) => {
          handlers.push(handler);
          return off;
        },
      },
    });
    ensurePermissionSubscriptions();
    ensurePermissionSubscriptions(); // idempotent
    expect(handlers).toHaveLength(1);
    handlers[0]?.(req("from-event"));
    expect(usePermissionStore.getState().pending).toHaveLength(1);
    cleanupPermissionSubscriptions();
    expect(off).toHaveBeenCalled();
  });
});

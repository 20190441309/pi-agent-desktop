import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    }),
  },
}));

vi.mock("electron-log/main", () => ({
  default: {
    error: logError,
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  setupSessionImporterIpc,
  withAction,
  withPiDriver,
  withUpdaterAction,
  withValidation,
} from "../helpers";
import { isIpcError } from "@shared";

describe("ipc helpers", () => {
  beforeEach(() => {
    handlers.clear();
    logError.mockClear();
  });

  describe("withValidation", () => {
    const schema = z.object({ name: z.string() });
    const opts = {
      invalidErrorKey: "err.invalid",
      invalidFallback: "invalid",
      failedErrorKey: "err.failed",
      failedLabel: "failed",
      logTag: "test",
    };

    it("returns invalid ipcError when schema fails", async () => {
      const result = await withValidation(schema, { name: 1 }, opts, async () => "ok");
      expect(isIpcError(result)).toBe(true);
      if (isIpcError(result)) {
        expect(result.code).toBe("err.invalid");
        expect(result.fallback).toBe("invalid");
      }
    });

    it("returns action result on success", async () => {
      await expect(
        withValidation(schema, { name: "x" }, opts, async (parsed) => parsed.name.toUpperCase()),
      ).resolves.toBe("X");
    });

    it("maps action throw to failed ipcError with context", async () => {
      const result = await withValidation(
        schema,
        { name: "x" },
        { ...opts, context: { id: "1" } },
        async () => {
          throw new Error("boom");
        },
      );
      expect(isIpcError(result)).toBe(true);
      if (isIpcError(result)) {
        expect(result.code).toBe("err.failed");
        expect(result.fallback).toContain("boom");
        expect(result.params).toEqual({ id: "1" });
      }
      expect(logError).toHaveBeenCalled();
    });
  });

  describe("withAction / withUpdaterAction", () => {
    it("returns success and maps failures", async () => {
      await expect(
        withAction(async () => 42, {
          failedErrorKey: "e",
          failedLabel: "L",
          logTag: "t",
        }),
      ).resolves.toBe(42);

      const fail = await withAction(
        async () => {
          throw "nope";
        },
        { failedErrorKey: "e", failedLabel: "L", logTag: "t" },
      );
      expect(isIpcError(fail)).toBe(true);
      if (isIpcError(fail)) {
        expect(fail.fallback).toBe("L: nope");
      }

      const up = await withUpdaterAction(
        async () => {
          throw new Error("net");
        },
        { errorKey: "up", label: "check", logTag: "u" },
      );
      expect(isIpcError(up)).toBe(true);
      if (isIpcError(up)) {
        expect(up.code).toBe("up");
        expect(up.fallback).toContain("net");
      }
    });
  });

  describe("withPiDriver", () => {
    it("returns driverNotInitialized when getter is null", async () => {
      const result = await withPiDriver(
        () => null,
        { failedErrorKey: "f", failedLabel: "L", logTag: "t" },
        async () => "ok",
      );
      expect(isIpcError(result)).toBe(true);
      if (isIpcError(result)) {
        expect(result.code).toBe("ipcErrors.pi.driverNotInitialized");
      }
    });

    it("runs action with driver and maps throws", async () => {
      const driver = { id: "d" } as never;
      await expect(
        withPiDriver(
          () => driver,
          { failedErrorKey: "f", failedLabel: "L", logTag: "t" },
          async (d) => d,
        ),
      ).resolves.toBe(driver);

      const fail = await withPiDriver(
        () => driver,
        { failedErrorKey: "f", failedLabel: "L", logTag: "t" },
        async () => {
          throw new Error("x");
        },
      );
      expect(isIpcError(fail)).toBe(true);
      if (isIpcError(fail)) {
        expect(fail.fallback).toContain("x");
      }
    });
  });

  describe("setupSessionImporterIpc", () => {
    it("registers scan and import handlers that call the importer", async () => {
      const importer = {
        scan: vi.fn(async (p: string) => ({ p, kind: "scan" })),
        import: vi.fn(async (p: string, sources: string[]) => ({ p, sources })),
      };
      const scanSchema = z.tuple([z.string()]);
      const importSchema = z.tuple([z.string(), z.array(z.string())]);
      setupSessionImporterIpc("claude-sessions", importer, scanSchema, importSchema);

      expect(handlers.has("claude-sessions:scan")).toBe(true);
      expect(handlers.has("claude-sessions:import")).toBe(true);

      const scan = handlers.get("claude-sessions:scan")!;
      await expect(scan({}, "C:/ws")).resolves.toEqual({ p: "C:/ws", kind: "scan" });

      const imp = handlers.get("claude-sessions:import")!;
      await expect(imp({}, "C:/ws", ["a.jsonl"])).resolves.toEqual({
        p: "C:/ws",
        sources: ["a.jsonl"],
      });
    });
  });
});

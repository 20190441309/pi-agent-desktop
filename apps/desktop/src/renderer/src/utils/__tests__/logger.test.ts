// Renderer logger 测试 (v1.0.10 H3 修复)
// 覆盖: 走 window.piAPI.log / piAPI 缺失降级 console / Error 序列化 / level 白名单

import { describe, it, expect, beforeEach, vi } from "vitest";
import { logger } from "../logger";

interface MockWindow {
    piAPI?: { log: ReturnType<typeof vi.fn> };
    consoleError?: ReturnType<typeof vi.spyOn>;
    consoleWarn?: ReturnType<typeof vi.spyOn>;
    consoleInfo?: ReturnType<typeof vi.spyOn>;
    consoleDebug?: ReturnType<typeof vi.spyOn>;
}

beforeEach(() => {
    (globalThis as { window: MockWindow }).window = {};
});

describe("logger: 走 window.piAPI.log", () => {
    it("error 调用 piAPI.log('error', msg, [extra])", () => {
        const log = vi.fn();
        (globalThis as { window: MockWindow }).window = { piAPI: { log } };
        logger.error("boom", new Error("EACCES"), { path: "/x" });
        expect(log).toHaveBeenCalledOnce();
        const [level, msg, extra] = log.mock.calls[0];
        expect(level).toBe("error");
        expect(msg).toBe("boom");
        // extra 是序列化后的字符串数组
        expect(Array.isArray(extra)).toBe(true);
        expect(extra[0]).toContain("EACCES"); // Error stack/message
        expect(extra[1]).toContain("/x");     // object 走 JSON.stringify
    });

    it("warn / info / debug 各自走对应 level", () => {
        const log = vi.fn();
        (globalThis as { window: MockWindow }).window = { piAPI: { log } };
        logger.warn("w");
        logger.info("i");
        logger.debug("d");
        expect(log.mock.calls.map((c) => c[0])).toEqual(["warn", "info", "debug"]);
    });

    it("Error 实例 → 包含 message + stack 的字符串", () => {
        const log = vi.fn();
        (globalThis as { window: MockWindow }).window = { piAPI: { log } };
        logger.error("fail", new Error("disk full"));
        const extra = log.mock.calls[0][2] as string[];
        expect(extra[0]).toContain("disk full");
    });
});

describe("logger: piAPI 缺失时降级 console", () => {
    it("没有 window.piAPI → 调 console.error", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        logger.error("degraded");
        expect(spy).toHaveBeenCalledWith("degraded");
        spy.mockRestore();
    });

    it("piAPI.log 自身抛 → 降级 console (不挂业务)", () => {
        (globalThis as { window: MockWindow }).window = {
            piAPI: { log: vi.fn(() => { throw new Error("bridge dead"); }) },
        };
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        logger.error("x");
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});

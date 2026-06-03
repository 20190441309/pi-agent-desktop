// Renderer-side logger (v1.0.6 → v1.0.10 H3 修复)
// 渲染层日志通过 IPC 走主进程 electron-log, 落文件可查.
// 之前 v1.0.6 注释承诺"统一落文件", 但 require("electron-log/renderer") 在 ESM
// renderer (Vite) 里直接 throw → 永远 fallback 到 console, 渲染层日志在生产环境丢.
// 现在改成: window.piAPI.log() 走主进程 → log 文件. 早期 bootstrap / 测试环境
// 拿不到 piAPI 时降级 console, 业务代码不感知.
//
// 调用方式:
//   import { logger } from "../../utils/logger";
//   logger.error("[files.ipc] scan error", err);
//   logger.warn("[PtyManager] write error for ${id}", err);

type LogLevel = "error" | "warn" | "info" | "debug";
type LogFn = (msg: string, ...args: unknown[]) => void;
type Logger = Record<LogLevel, LogFn>;

/** 把任意 arg 序列化成字符串数组, 避免 IPC 序列化 Error / 对象失败 */
function stringifyArgs(args: unknown[]): string[] {
    return args.map((a) => {
        if (a instanceof Error) {
            return a.stack ? `${a.message}\n${a.stack}` : a.message;
        }
        if (typeof a === "string") return a;
        if (typeof a === "number" || typeof a === "boolean") return String(a);
        try {
            return JSON.stringify(a);
        } catch {
            return String(a);
        }
    });
}

function dispatch(level: LogLevel, msg: string, args: unknown[]): void {
    // window 全局类型在 @shared 里声明, 这里 typeof + 窄化避免早期 bootstrap 时崩
    const w = typeof window !== "undefined" ? (window as { piAPI?: { log?: (...a: unknown[]) => void } }) : undefined;
    const api = w?.piAPI;
    if (api && typeof api.log === "function") {
        try {
            api.log(level, msg, stringifyArgs(args));
            return;
        } catch {
            // piAPI.log 自身抛了 (极端: preload bridge 挂了), 降级 console
        }
    }
    // 兜底: 测试 / 早期 bootstrap / bridge 挂了
    const fn = console[level === "debug" ? "debug" : level];
    if (typeof fn === "function") fn(msg, ...args);
}

export const logger: Logger = {
    error: (msg, ...args) => dispatch("error", msg, args),
    warn: (msg, ...args) => dispatch("warn", msg, args),
    info: (msg, ...args) => dispatch("info", msg, args),
    debug: (msg, ...args) => dispatch("debug", msg, args),
};

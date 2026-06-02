// Renderer-side logger (v1.0.6)
// 替换散落的 console.error / console.warn, 统一走主进程 electron-log
//
// 设计:
// - 直接用 console 是"就地"打日志, 渲染层 devtools 看得见但生产环境丢了
// - 走 IPC 让主进程 electron-log 落文件, 等于把渲染端日志也接到 M7
//   observability 那个统一日志通道
// - 同一个 logger 后面接 Sentry / LogRocket 不用改业务代码
//
// 调用方式:
//   import { logger } from "../../utils/logger";
//   logger.error("[files.ipc] scan error", err);
//   logger.warn("[PtyManager] write error for ${id}", err);

// 在 vitest jsdom 环境 + electron-log IPC 不可用, 走 console fallback.
// 业务代码只 import logger, 不用关心环境.
type LogFn = (msg: string, ...args: unknown[]) => void;

let logImpl: {
    error: LogFn;
    warn: LogFn;
    info: LogFn;
    debug: LogFn;
};

try {
    // electron-log/renderer 在 jsdom 环境里会 fail (调 window.ipcRenderer 不存在)
    // require 放 try 防止 vitest setup 卡死
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("electron-log/renderer") as {
        error: LogFn;
        warn: LogFn;
        info: LogFn;
        debug: LogFn;
    };
    logImpl = mod;
} catch {
    logImpl = {
        error: (msg, ...args) => console.error(msg, ...args),
        warn: (msg, ...args) => console.warn(msg, ...args),
        info: (msg, ...args) => console.info(msg, ...args),
        debug: (msg, ...args) => console.debug(msg, ...args),
    };
}

export const logger: typeof logImpl = logImpl;

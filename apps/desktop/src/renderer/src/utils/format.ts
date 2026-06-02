// 时间格式化 helper (v1.0.9)
// 统一所有 "Date | string | number | undefined → 字符串" 入口
//
// 背景: 跨进程字段在 @shared 是 number (ms epoch), 但 store 内部有时是
// Date, 有时是 string (ISO), 有时是 number. 业务 UI 经常直接写
// `new Date(x).toLocaleTimeString()` 然后忘记判空. 这次把所有入口收成一个
// helper, 加 safe guard (无效输入 → 空串而不是 "Invalid Date").
//
// 不动 store 内部类型 (Date / number 混用是历史包袱, 改 store 类型会引发
// 连锁更新). 只在 UI 渲染前走一层格式转换.

/** 任意时间值 → Date | null. 用于 lastActiveAt / timestamp / createdAt 入口. */
export function toDate(value: unknown): Date | null {
    if (value == null) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "number" || typeof value === "string") {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}

/** "14:32:05" — 消息时间戳 (秒级) */
export function formatTime(value: unknown): string {
    const d = toDate(value);
    if (!d) return "";
    return d.toLocaleTimeString();
}

/** "2026-06-02 14:32" — 日期+时间 (中等粒度, 列表用) */
export function formatDateTime(value: unknown): string {
    const d = toDate(value);
    if (!d) return "";
    return d.toLocaleString();
}

/** "2026-06-02" — 短日期 (会话列表用) */
export function formatDate(value: unknown): string {
    const d = toDate(value);
    if (!d) return "";
    return d.toLocaleDateString();
}

/** ISO 字符串 — 用于 <time dateTime={...}> 元素的可机器读属性 */
export function formatIso(value: unknown): string {
    const d = toDate(value);
    if (!d) return "";
    return d.toISOString();
}

/** 相对时间 (e.g. "2 分钟前"). null/无效 → 空串. */
export function formatRelative(value: unknown, now: Date = new Date()): string {
    const d = toDate(value);
    if (!d) return "";
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) return "刚刚"; // 未来时间 (本地时钟漂移) 兜底
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return "刚刚";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} 分钟前`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} 小时前`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day} 天前`;
    // > 30 天退化到短日期
    return formatDate(d);
}

/** 耗时 (ms → "1.2s" / "350ms" / "2m 3s"). 无 endTime → "进行中". */
export function formatDuration(start: unknown, end?: unknown, now: Date = new Date()): string {
    const s = toDate(start);
    if (!s) return "";
    const e = end == null ? now : toDate(end);
    if (!e) return "进行中";
    const ms = e.getTime() - s.getTime();
    if (ms < 0) return "0s";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const m = Math.floor(ms / 60_000);
    const s2 = Math.floor((ms % 60_000) / 1000);
    return `${m}m ${s2}s`;
}

/** 类型守卫: value 是有效 Date / 时间字符串 / 数字. */
export function isValidTimestamp(value: unknown): value is Date | string | number {
    return toDate(value) !== null;
}

/** 类型守卫: value 是 number (用于 lastActiveAt 等 ms epoch 字段). */
export function isNumberOrUndefined(value: unknown): value is number | undefined {
    return value === undefined || typeof value === "number";
}

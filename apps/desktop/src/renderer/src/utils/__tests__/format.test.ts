// 时间格式化 helper 测试 (v1.0.9)
//
// 覆盖:
// 1. toDate: 各种输入 (Date / number / string / null / undefined / 无效)
// 2. formatTime / formatDateTime / formatDate: 命中 + 无效输入降级空串
// 3. formatIso: 输出 ISO 字符串, 无效输入空串
// 4. formatRelative: 不同时间差 (秒/分/时/天/月) 走不同分支
// 5. formatDuration: 毫秒/秒/分, 进行中, 负值
// 6. isValidTimestamp: 类型守卫

import { describe, it, expect, vi } from "vitest";
import {
    toDate,
    formatTime,
    formatDateTime,
    formatDate,
    formatIso,
    formatRelative,
    formatDuration,
    isValidTimestamp,
} from "../format";

describe("toDate", () => {
    it("Date 实例", () => {
        const d = new Date(2026, 5, 2, 14, 32, 5);
        expect(toDate(d)).toBe(d); // 同一引用
    });

    it("number (ms epoch)", () => {
        const ms = new Date(2026, 5, 2).getTime();
        const d = toDate(ms);
        expect(d).toBeInstanceOf(Date);
        expect(d?.getFullYear()).toBe(2026);
    });

    it("string (ISO)", () => {
        const d = toDate("2026-06-02T14:32:05Z");
        expect(d).toBeInstanceOf(Date);
        expect(d?.getFullYear()).toBe(2026);
    });

    it("null / undefined → null", () => {
        expect(toDate(null)).toBeNull();
        expect(toDate(undefined)).toBeNull();
    });

    it("无效 string / number → null (不抛)", () => {
        expect(toDate("not a date")).toBeNull();
        expect(toDate(NaN)).toBeNull();
    });

    it("无效 Date 实例 → null", () => {
        expect(toDate(new Date("invalid"))).toBeNull();
    });

    it("非时间类型 (boolean / object) → null", () => {
        expect(toDate(true)).toBeNull();
        expect(toDate({ foo: 1 })).toBeNull();
    });
});

describe("formatTime / formatDateTime / formatDate / formatIso", () => {
    const ts = new Date(2026, 5, 2, 14, 32, 5).getTime(); // 本地时区

    it("formatTime 返本地时区时间串", () => {
        const s = formatTime(ts);
        // toLocaleTimeString 格式依赖 locale; 至少含冒号
        expect(s).toContain(":");
    });

    it("formatDateTime 含日期+时间", () => {
        const s = formatDateTime(ts);
        expect(s).toContain("2026");
    });

    it("formatDate 返短日期", () => {
        const s = formatDate(ts);
        expect(s).toMatch(/2026/);
    });

    it("formatIso 返 ISO 字符串", () => {
        const s = formatIso(ts);
        expect(s).toBe(new Date(ts).toISOString());
    });

    it("无效输入返空串 (不是 'Invalid Date')", () => {
        expect(formatTime(null)).toBe("");
        expect(formatTime(undefined)).toBe("");
        expect(formatTime("bad")).toBe("");
        expect(formatDateTime(null)).toBe("");
        expect(formatDate(NaN)).toBe("");
        expect(formatIso(null)).toBe("");
    });
});

describe("formatRelative", () => {
    const now = new Date(2026, 5, 2, 14, 32, 5);
    // 简版 t: 跟 v1.0.9 中文映射一致, 验证函数本身不依赖具体 i18next 实例
    const tZh = (key: string, opts?: Record<string, unknown>): string => {
        const n = opts?.count as number | undefined;
        switch (key) {
            case "common.time.justNow": return "刚刚";
            case "common.time.minutesAgo": return `${n} 分钟前`;
            case "common.time.hoursAgo": return `${n} 小时前`;
            case "common.time.daysAgo": return `${n} 天前`;
            default: return key;
        }
    };

    it("< 60s → 刚刚", () => {
        expect(formatRelative(new Date(now.getTime() - 30_000), tZh, now)).toBe("刚刚");
    });

    it("1 分钟前", () => {
        expect(formatRelative(new Date(now.getTime() - 60_000), tZh, now)).toBe("1 分钟前");
    });

    it("1 小时前", () => {
        expect(formatRelative(new Date(now.getTime() - 60 * 60_000), tZh, now)).toBe("1 小时前");
    });

    it("1 天前", () => {
        expect(formatRelative(new Date(now.getTime() - 24 * 60 * 60_000), tZh, now)).toBe("1 天前");
    });

    it("> 30 天 → 退化到 formatDate (短日期)", () => {
        const past = new Date(now.getTime() - 60 * 24 * 60 * 60_000);
        const s = formatRelative(past, tZh, now);
        expect(s).toMatch(/2025|2026/); // 短日期格式
        expect(s).not.toContain("天前");
    });

    it("未来时间 (本地时钟漂移) → '刚刚'", () => {
        expect(formatRelative(new Date(now.getTime() + 60_000), tZh, now)).toBe("刚刚");
    });

    it("无效输入 → 空串 (t 不会被调)", () => {
        const tSpy = vi.fn(tZh);
        expect(formatRelative(null, tSpy, now)).toBe("");
        expect(formatRelative("bad", tSpy, now)).toBe("");
        expect(tSpy).not.toHaveBeenCalled();
    });

    it("en locale 走分钟/小时分支 → 英文串", () => {
        const tEn = (key: string, opts?: Record<string, unknown>): string => {
            const n = opts?.count as number | undefined;
            switch (key) {
                case "common.time.minutesAgo": return `${n} min ago`;
                case "common.time.hoursAgo": return `${n} h ago`;
                default: return key;
            }
        };
        expect(formatRelative(new Date(now.getTime() - 5 * 60_000), tEn, now)).toBe("5 min ago");
        expect(formatRelative(new Date(now.getTime() - 3 * 60 * 60_000), tEn, now)).toBe("3 h ago");
    });
});

describe("formatDuration", () => {
    const start = new Date(2026, 5, 2, 14, 0, 0).getTime();

    it("毫秒级: 350ms", () => {
        expect(formatDuration(start, start + 350)).toBe("350ms");
    });

    it("秒级: 1.2s", () => {
        expect(formatDuration(start, start + 1_234)).toBe("1.2s");
    });

    it("分级: 2m 3s", () => {
        expect(formatDuration(start, start + 2 * 60_000 + 3_000)).toBe("2m 3s");
    });

    it("end=undefined + now → 进行中 (用 now 替代)", () => {
        // start = 1970-01-01, now = 大约 2026 → 巨大数字, 走 '2m 3s' 分支太短
        // 用相对时间测: start 跟 now 差 30s
        const s = new Date(Date.now() - 30_000).getTime();
        const result = formatDuration(s);
        // 30s 应该走 < 60_000 分支, toFixed(1)
        expect(result).toMatch(/\d+\.\ds/);
    });

    it("负值 → 0s (时钟漂移兜底)", () => {
        expect(formatDuration(start, start - 100)).toBe("0s");
    });

    it("start 无效 → 空串", () => {
        expect(formatDuration(null)).toBe("");
    });
});

describe("isValidTimestamp", () => {
    it("Date / number / ISO string → true", () => {
        expect(isValidTimestamp(new Date())).toBe(true);
        expect(isValidTimestamp(1_700_000_000_000)).toBe(true);
        expect(isValidTimestamp("2026-06-02")).toBe(true);
    });

    it("null / undefined / 'bad' / {} → false", () => {
        expect(isValidTimestamp(null)).toBe(false);
        expect(isValidTimestamp(undefined)).toBe(false);
        expect(isValidTimestamp("bad")).toBe(false);
        expect(isValidTimestamp({})).toBe(false);
    });
});

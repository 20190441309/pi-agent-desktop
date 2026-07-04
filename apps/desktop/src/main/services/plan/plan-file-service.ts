// Plan file service (main process)
// 负责 .pi/plans/ 目录下 plan markdown 文件的 CRUD + 状态流转.
//
// 设计:
//  - 文件格式: YAML frontmatter (5 字段) + 空行 + markdown body
//  - 不引入 gray-matter / js-yaml: 仅 5 个标量字段,手写最小 parser/serializer
//  - 同步 fs API: 与 main 进程其它 service (agent-modes / session-store) 风格一致
//  - complete / delete 通过 renameSync 移动到子目录,避免数据丢失
//  - slug sanitize: 仅保留 [a-z0-9-],防御性清洗 (caller 应已清洗,但这里兜底)
//
// 类型权威源在 @shared (Task 4.1). 主进程从这里 re-export 以保持本地调用方
// 既能从 @shared 引入, 也能从 ./plan-file-service 引入 (兼容现有测试).

import { randomUUID } from "crypto";
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    renameSync,
    writeFileSync,
} from "fs";
import { basename, resolve } from "path";
import type {
    PlanStatus,
    PlanRecord,
    PlanCreateInput,
    PlanUpdateInput,
    PlanListOptions,
} from "@shared";

// ── Types (re-export from @shared) ────────────────────────────────────

export type { PlanStatus, PlanRecord, PlanCreateInput, PlanUpdateInput, PlanListOptions };

// ── Constants ─────────────────────────────────────────────────────────

const MAX_SLUG_LENGTH = 50;
const FALLBACK_SLUG = "plan";
const DEFAULT_TITLE = "未命名计划";
const PLANS_REL_DIR = [".pi", "plans"] as const;
const COMPLETED_DIR = "completed";
const CANCELLED_DIR = "cancelled";

const VALID_STATUSES: readonly PlanStatus[] = ["draft", "executing", "completed", "cancelled"];

// ── Slug sanitize ─────────────────────────────────────────────────────

/**
 * Slug 清洗规则:
 *  1. 转小写
 *  2. 空白 / 下划线 → "-"
 *  3. 删除非 [a-z0-9-] 字符 (CJK / 特殊符号全部剔除)
 *  4. 合并连续 "-"
 *  5. 去除首尾 "-"
 *  6. 截断到 50 字符 (去除截断后尾部残余 "-")
 *  7. 空串兜底为 "plan"
 */
function sanitizeSlug(input: string): string {
    const normalized = (input ?? "")
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    const collapsed = normalized
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!collapsed) return FALLBACK_SLUG;
    if (collapsed.length <= MAX_SLUG_LENGTH) return collapsed;
    const truncated = collapsed.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");
    return truncated || FALLBACK_SLUG;
}

function buildFilename(timestamp: number, slug: string): string {
    return `${timestamp}-${slug}.md`;
}

// ── Path helpers ──────────────────────────────────────────────────────

function plansDir(workspacePath: string): string {
    return resolve(workspacePath, ...PLANS_REL_DIR);
}

/**
 * 拼接 plan 文件源路径. 使用 basename 防御 path traversal (filename 不应包含路径分隔符).
 */
function sourcePath(workspacePath: string, filename: string): string {
    return resolve(plansDir(workspacePath), basename(filename));
}

function completedDir(workspacePath: string): string {
    return resolve(plansDir(workspacePath), COMPLETED_DIR);
}

function cancelledDir(workspacePath: string): string {
    return resolve(plansDir(workspacePath), CANCELLED_DIR);
}

// ── Minimal YAML frontmatter parser/serializer ────────────────────────
//
// 仅支持 5 个标量字段 (id / title / status / created_at / updated_at),
// 不支持嵌套 / 数组 / 多行字符串. title 用双引号包裹并转义 `"` 与 `\`,
// 其它字段为简单标量. 解析时容错: 字段缺失或类型不符返回 null (caller 决定是 warn 还是 throw).

interface PlanFrontmatter {
    id: string;
    title: string;
    status: PlanStatus;
    created_at: number;
    updated_at: number;
}

function isPlanStatus(value: string): value is PlanStatus {
    return (VALID_STATUSES as readonly string[]).includes(value);
}

function escapeYamlString(value: string): string {
    // 双引号字符串: 转义反斜杠与双引号
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
}

function unescapeYamlString(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
        const inner = trimmed.slice(1, -1);
        // 反转义: \" → ", \\ → \
        return inner.replace(/\\(.)/g, (_, ch: string) => ch);
    }
    return trimmed;
}

function serializeFrontmatter(meta: PlanFrontmatter, body: string): string {
    return [
        "---",
        `id: ${meta.id}`,
        `title: ${escapeYamlString(meta.title)}`,
        `status: ${meta.status}`,
        `created_at: ${meta.created_at}`,
        `updated_at: ${meta.updated_at}`,
        "---",
        "",
        body,
    ].join("\n");
}

/**
 * 解析 plan 文件内容. 返回 null 表示格式不合法 (字段缺失 / status 非法 / 时间戳非数字).
 * body 仅去掉 frontmatter 后的一个格式空行,保留其它换行与尾部空白.
 */
function parseFile(raw: string, path: string): PlanRecord | null {
    if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) return null;
    const rest = raw.replace(/^---\r?\n/, "");
    const endMatch = rest.match(/\r?\n---\r?\n/);
    if (!endMatch || endMatch.index === undefined) return null;
    const frontmatterBlock = rest.slice(0, endMatch.index);
    const bodyStart = endMatch.index + endMatch[0].length;
    // 去掉 frontmatter 与 body 之间的一个格式空行 (LF 或 CRLF)
    const body = rest.slice(bodyStart).replace(/^\r?\n/, "");

    const fields = new Map<string, string>();
    for (const line of frontmatterBlock.split(/\r?\n/)) {
        if (!line.trim() || line.trim().startsWith("#")) continue;
        const colon = line.indexOf(":");
        if (colon === -1) continue;
        const key = line.slice(0, colon).trim();
        const value = line.slice(colon + 1).trim();
        if (key) fields.set(key, value);
    }

    const id = fields.get("id");
    const titleRaw = fields.get("title");
    const status = fields.get("status");
    const createdAtStr = fields.get("created_at");
    const updatedAtStr = fields.get("updated_at");
    if (!id || titleRaw === undefined || !status || !createdAtStr || !updatedAtStr) {
        return null;
    }
    if (!isPlanStatus(status)) return null;
    const createdAt = Number(createdAtStr);
    const updatedAt = Number(updatedAtStr);
    if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return null;

    return {
        id,
        filename: basename(path),
        path,
        title: unescapeYamlString(titleRaw),
        status,
        createdAt,
        updatedAt,
        content: body,
    };
}

// ── PlanFileService ───────────────────────────────────────────────────

export class PlanFileService {
    /**
     * 返回 plan 文件的绝对路径. timestamp 取当前时间,slug 经 sanitize.
     * 主要供 caller (Task 4 IPC) 预测文件位置或做存在性判断.
     */
    resolvePath(workspacePath: string, slug: string): string {
        const sanitized = sanitizeSlug(slug);
        return resolve(plansDir(workspacePath), buildFilename(Date.now(), sanitized));
    }

    /**
     * 创建 plan 文件. 写入 frontmatter + body,返回 PlanRecord.
     * 时间戳同时用于 filename 与 created_at / updated_at,保证三者一致.
     */
    create(workspacePath: string, input: PlanCreateInput): PlanRecord {
        const timestamp = Date.now();
        const sanitized = sanitizeSlug(input.slug);
        const filename = buildFilename(timestamp, sanitized);
        const dir = plansDir(workspacePath);
        mkdirSync(dir, { recursive: true });

        const id = randomUUID();
        const title = (input.title ?? "").trim() || DEFAULT_TITLE;
        const content = input.content ?? "";
        const meta: PlanFrontmatter = {
            id,
            title,
            status: "draft",
            created_at: timestamp,
            updated_at: timestamp,
        };
        const filePath = resolve(dir, filename);
        const fileContent = serializeFrontmatter(meta, content);
        writeFileSync(filePath, fileContent, "utf8");

        return {
            id,
            filename,
            path: filePath,
            title,
            status: "draft",
            createdAt: timestamp,
            updatedAt: timestamp,
            content,
        };
    }

    /**
     * 读取 plan 文件并解析. 文件缺失返回 null; 解析失败也返回 null (不抛错).
     */
    read(workspacePath: string, filename: string): PlanRecord | null {
        const filePath = sourcePath(workspacePath, filename);
        if (!existsSync(filePath)) return null;
        let raw: string;
        try {
            raw = readFileSync(filePath, "utf8");
        } catch (err) {
            console.warn(`[PlanFileService] Failed to read plan file: ${filePath}: ${(err as Error).message}`);
            return null;
        }
        const record = parseFile(raw, filePath);
        if (!record) {
            console.warn(`[PlanFileService] Failed to parse plan file: ${filePath}`);
            return null;
        }
        return record;
    }

    /**
     * 更新 plan 文件. content / status / title 任一可选,未提供的字段保留原值.
     * 文件缺失抛 `Error("Plan not found: <filename>")`.
     */
    update(workspacePath: string, filename: string, input: PlanUpdateInput): PlanRecord {
        const existing = this.read(workspacePath, filename);
        if (!existing) {
            throw new Error(`Plan not found: ${filename}`);
        }
        const nextTitle = input.title !== undefined
            ? ((input.title ?? "").trim() || existing.title)
            : existing.title;
        const nextStatus = input.status !== undefined ? input.status : existing.status;
        const nextContent = input.content !== undefined ? input.content : existing.content;
        const updatedAt = Date.now();

        const meta: PlanFrontmatter = {
            id: existing.id,
            title: nextTitle,
            status: nextStatus,
            created_at: existing.createdAt,
            updated_at: updatedAt,
        };
        const filePath = sourcePath(workspacePath, filename);
        const fileContent = serializeFrontmatter(meta, nextContent);
        writeFileSync(filePath, fileContent, "utf8");

        return {
            id: existing.id,
            filename: basename(filename),
            path: filePath,
            title: nextTitle,
            status: nextStatus,
            createdAt: existing.createdAt,
            updatedAt,
            content: nextContent,
        };
    }

    /**
     * 标记 plan 为 completed 并移动到 .pi/plans/completed/.
     * 文件缺失抛错 (与 update 行为一致).
     */
    complete(workspacePath: string, filename: string): PlanRecord {
        const updated = this.update(workspacePath, filename, { status: "completed" });
        const source = sourcePath(workspacePath, filename);
        const targetDir = completedDir(workspacePath);
        mkdirSync(targetDir, { recursive: true });
        const targetPath = resolve(targetDir, basename(filename));
        if (existsSync(targetPath)) {
            throw new Error(`Plan already exists in ${COMPLETED_DIR}/: ${filename}`);
        }
        renameSync(source, targetPath);
        return { ...updated, path: targetPath };
    }

    /**
     * 标记 plan 为 cancelled 并移动到 .pi/plans/cancelled/.
     * 文件缺失静默返回 (idempotent).
     */
    delete(workspacePath: string, filename: string): void {
        const existing = this.read(workspacePath, filename);
        if (!existing) return;
        // 先在原位置写入 cancelled frontmatter,再移动 (失败时原文件状态已更新)
        this.update(workspacePath, filename, { status: "cancelled" });
        const source = sourcePath(workspacePath, filename);
        const targetDir = cancelledDir(workspacePath);
        mkdirSync(targetDir, { recursive: true });
        const targetPath = resolve(targetDir, basename(filename));
        if (existsSync(targetPath)) {
            throw new Error(`Plan already exists in ${CANCELLED_DIR}/: ${filename}`);
        }
        renameSync(source, targetPath);
    }

    /**
     * 列出 plan 文件. 默认仅扫描 .pi/plans/ 顶层 (draft / executing 状态).
     * includeCompleted / includeCancelled 为 true 时分别追加扫描 completed/ / cancelled/.
     * 按 created_at desc 排序. 解析失败的文件跳过并 warn.
     */
    list(workspacePath: string, options?: PlanListOptions): PlanRecord[] {
        const includeCompleted = options?.includeCompleted ?? false;
        const includeCancelled = options?.includeCancelled ?? false;
        const rootDir = plansDir(workspacePath);
        const records: PlanRecord[] = [];

        const scanDir = (dir: string): void => {
            if (!existsSync(dir)) return;
            let entries: string[];
            try {
                entries = readdirSync(dir);
            } catch (err) {
                console.warn(`[PlanFileService] Failed to read directory ${dir}: ${(err as Error).message}`);
                return;
            }
            for (const entry of entries) {
                if (!entry.endsWith(".md")) continue;
                const filePath = resolve(dir, entry);
                try {
                    const raw = readFileSync(filePath, "utf8");
                    const record = parseFile(raw, filePath);
                    if (!record) {
                        console.warn(`[PlanFileService] Skipping unparseable plan file: ${filePath}`);
                        continue;
                    }
                    records.push(record);
                } catch (err) {
                    console.warn(`[PlanFileService] Skipping unreadable plan file: ${filePath}: ${(err as Error).message}`);
                }
            }
        };

        scanDir(rootDir);
        if (includeCompleted) scanDir(completedDir(workspacePath));
        if (includeCancelled) scanDir(cancelledDir(workspacePath));

        records.sort((a, b) => b.createdAt - a.createdAt);
        return records;
    }
}

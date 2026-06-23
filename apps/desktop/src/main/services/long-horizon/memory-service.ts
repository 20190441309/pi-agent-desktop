import { appendFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

export type MemoryScope = "project" | "session" | "global";
export type MemoryKind = "note" | "checkpoint" | "task-progress" | "summary" | "history";

export interface MemoryRecord {
    id: string;
    scope: MemoryScope;
    kind: MemoryKind;
    text: string;
    parentId?: string;
    workspaceId?: string;
    sessionId?: string;
    tags?: string[];
    createdAt: number;
}

export type MemoryInput = Omit<MemoryRecord, "id" | "createdAt">;

export interface MemorySearchOptions {
    workspaceId?: string;
    sessionId?: string;
    limit?: number;
    searchScoreFloor?: number;
    includeHistoryFallback?: boolean;
}

export type MemorySearchResult = MemoryRecord & { score: number };

export interface MemoryTreeNode {
    record: MemoryRecord;
    children: MemoryTreeNode[];
}

export class MemoryService {
    private readonly records: MemoryRecord[] = [];
    private readonly index = new Map<string, Set<string>>();
    private readonly recordsById = new Map<string, MemoryRecord>();
    private readonly childrenByParent = new Map<string, Set<string>>();
    private readonly jsonlPath: string;
    // 内存记录上限: 超过后淘汰最旧的 history 记录, 防止长期运行内存无界增长
    private static MAX_RECORDS = 5000;
    // 平均文档长度缓存: records 变更时失效, 避免每次搜索 O(n) 重算
    private avgDocLengthCache: number | null = null;

    constructor(opts: { rootDir: string }) {
        mkdirSync(opts.rootDir, { recursive: true });
        this.jsonlPath = join(opts.rootDir, "memory.jsonl");
        this.load();
    }

    put(input: MemoryInput): MemoryRecord {
        const record: MemoryRecord = {
            ...input,
            id: randomUUID(),
            createdAt: Date.now(),
        };
        this.addToMemory(record);
        this.evictIfFull();
        appendFileSync(this.jsonlPath, `${JSON.stringify(record)}\n`, "utf8");
        return record;
    }

    putHistory(input: { workspaceId?: string; sessionId?: string; text: string; tags?: string[] }): MemoryRecord {
        return this.put({
            scope: input.sessionId ? "session" : "project",
            workspaceId: input.workspaceId,
            sessionId: input.sessionId,
            kind: "history",
            text: input.text,
            tags: input.tags,
        });
    }

    search(query: string, options: MemorySearchOptions = {}): MemorySearchResult[] {
        const terms = tokenize(query);
        if (terms.length === 0) return [];
        const memoryHits = this.searchKind(terms, options, (record) => record.kind !== "history");
        if (memoryHits.length > 0 || !options.includeHistoryFallback) return memoryHits;
        return this.searchKind(terms, options, (record) => record.kind === "history");
    }

    getTree(rootId: string): MemoryTreeNode | null {
        const record = this.recordsById.get(rootId);
        if (!record) return null;
        return {
            record,
            children: [...(this.childrenByParent.get(rootId) ?? [])]
                .map((childId) => this.getTree(childId))
                .filter((node): node is MemoryTreeNode => node !== null),
        };
    }

    private searchKind(
        terms: string[],
        options: MemorySearchOptions,
        predicate: (record: MemoryRecord) => boolean,
    ): MemorySearchResult[] {
        const candidateIds = new Set<string>();
        for (const term of terms) {
            for (const id of this.index.get(term) ?? []) candidateIds.add(id);
        }
        const scored = [...candidateIds]
            .map((id) => this.recordsById.get(id))
            .filter((record): record is MemoryRecord => record !== undefined)
            .filter((record) => matchesScope(record, options))
            .filter(predicate)
            .map((record) => ({ ...record, score: this.bm25(record, terms) }))
            .filter((record) => record.score > 0)
            .sort((a, b) => b.score - a.score || b.createdAt - a.createdAt)
            .slice(0, Math.min((options.limit ?? 8) * 3, 50));
        if (scored.length === 0) return [];
        const floor = options.searchScoreFloor ?? 0.15;
        const cutoff = floor > 0 ? scored[0].score * floor : -Infinity;
        return scored
            .filter((record, index) => index === 0 || record.score >= cutoff)
            .slice(0, options.limit ?? 8);
    }

    private load(): void {
        if (!existsSync(this.jsonlPath)) return;
        const content = readFileSync(this.jsonlPath, "utf8");
        for (const line of content.split(/\r?\n/)) {
            if (!line.trim()) continue;
            try {
                this.addToMemory(JSON.parse(line) as MemoryRecord);
            } catch {
                // Skip corrupted mirror lines; later writes keep appending valid records.
            }
        }
    }

    private addToMemory(record: MemoryRecord): void {
        this.records.push(record);
        this.recordsById.set(record.id, record);
        if (record.parentId) {
            const children = this.childrenByParent.get(record.parentId) ?? new Set<string>();
            children.add(record.id);
            this.childrenByParent.set(record.parentId, children);
        }
        for (const token of tokenize(`${record.text} ${(record.tags ?? []).join(" ")}`)) {
            const bucket = this.index.get(token) ?? new Set<string>();
            bucket.add(record.id);
            this.index.set(token, bucket);
        }
        // 记录集变更, 失效平均文档长度缓存
        this.avgDocLengthCache = null;
    }

    /** 超过 MAX_RECORDS 时淘汰最旧的 history 记录 (保留 note/checkpoint/summary 等结构化记录) */
    private evictIfFull(): void {
        while (this.records.length > MemoryService.MAX_RECORDS) {
            const oldestHistoryIdx = this.records.findIndex((r) => r.kind === "history");
            if (oldestHistoryIdx === -1) break; // 无 history 可淘汰, 停止以保护结构化记录
            const [removed] = this.records.splice(oldestHistoryIdx, 1);
            this.removeIndexEntry(removed);
        }
    }

    private removeIndexEntry(record: MemoryRecord): void {
        this.recordsById.delete(record.id);
        for (const token of tokenize(`${record.text} ${(record.tags ?? []).join(" ")}`)) {
            this.index.get(token)?.delete(record.id);
        }
        if (record.parentId) {
            this.childrenByParent.get(record.parentId)?.delete(record.id);
        }
        this.avgDocLengthCache = null;
    }

    private bm25(record: MemoryRecord, terms: string[]): number {
        const tokens = tokenize(`${record.text} ${(record.tags ?? []).join(" ")}`);
        if (tokens.length === 0) return 0;
        const termFrequency = new Map<string, number>();
        for (const token of tokens) termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
        const avgLength = this.averageDocumentLength();
        const k1 = 1.2;
        const b = 0.75;
        return terms.reduce((sum, term) => {
            const tf = termFrequency.get(term) ?? 0;
            if (tf === 0) return sum;
            const docFreq = this.index.get(term)?.size ?? 0;
            const idf = Math.log(1 + (this.records.length - docFreq + 0.5) / (docFreq + 0.5));
            const denom = tf + k1 * (1 - b + b * (tokens.length / avgLength));
            return sum + idf * ((tf * (k1 + 1)) / denom);
        }, 0);
    }

    private averageDocumentLength(): number {
        if (this.avgDocLengthCache !== null) return this.avgDocLengthCache;
        if (this.records.length === 0) {
            this.avgDocLengthCache = 1;
            return 1;
        }
        const total = this.records.reduce((sum, record) => sum + tokenize(`${record.text} ${(record.tags ?? []).join(" ")}`).length, 0);
        this.avgDocLengthCache = Math.max(1, total / this.records.length);
        return this.avgDocLengthCache;
    }
}

function matchesScope(record: MemoryRecord, options: MemorySearchOptions): boolean {
    if (record.scope === "global") return true;
    if (options.workspaceId && record.workspaceId && record.workspaceId !== options.workspaceId) return false;
    if (options.sessionId && record.sessionId && record.sessionId !== options.sessionId) return false;
    return true;
}

function tokenize(value: string): string[] {
    const normalized = value.toLowerCase();
    const ascii = normalized.match(/[a-z0-9_-]{2,}/g) ?? [];
    const cjk = normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
    const cjkBigrams = cjk.flatMap((chunk) => {
        const result: string[] = [chunk];
        for (let i = 0; i < chunk.length - 1; i += 1) result.push(chunk.slice(i, i + 2));
        return result;
    });
    return [...new Set([...ascii, ...cjkBigrams])];
}

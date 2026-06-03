// Frontend Type Definitions
// v1.0.5: 大部分类型迁移到 @shared (跨进程共享). 这里只保留 renderer 独有的
// (ProjectInfo, FileTreeNode) 和 store 内部用的旧 alias (WorkspaceData / SessionData),
// 它们正逐步替换为 @shared/Workspace / @shared/Session.

// 跨进程共享类型 re-export (Ui 组件想用 @shared 也行, 但保留这个 barrel 兼容)
export type {
    PiEvent,
    PiStatus as PiDriverStatus,
    PiInstallProgress,
    GitBranch as BranchInfo,
    GitLogEntry as CommitInfo,
    AppSettings as AppSettingsData,
} from "@shared";

// 共享 ProjectInfo: ProjectPanel 用了 ProjectInfo (renderer 独有, 不在 @shared)
export interface ProjectInfo {
    type: "node" | "python" | "rust" | "go" | "java" | "unknown";
    name: string;
    version?: string;
    rootPath: string;
    configFiles: string[];
    packageManager?: "npm" | "yarn" | "pnpm" | "bun" | "pip" | "cargo" | "go";
    hasGit: boolean;
    scripts?: Record<string, string>;
}

// file tree (renderer 独有, 跟 ProjectPanel 配套)
export interface FileTreeNode {
    name: string;
    path: string;
    type: "file" | "directory";
    children?: FileTreeNode[];
    extension?: string;
    size?: number;
}

// Skill/Plugin (renderer 暂时用本地类型, 后续统一到 @shared)
export interface SkillData {
    name: string;
    description?: string;
    path: string;
    enabled: boolean;
}

export interface PluginData {
    name: string;
    description?: string;
    version?: string;
    enabled: boolean;
    type: "provider" | "extension" | "tool";
}

export interface PiFullConfigData {
    configPath: string;
    defaultProvider: string;
    defaultModel: string;
    providers: Array<{
        id: string;
        name: string;
        baseUrl?: string;
        modelCount: number;
        hasApiKey: boolean;
    }>;
}

// Workspace/Session store 内部用 (v1.0.5 跟 @shared/Workspace 同一形状,
// 但 store 类型独立, 不强求 store 走 @shared, 后续 v1.0.6 慢慢替换)
export interface WorkspaceData {
    id: string;
    name: string;
    path: string;
    createdAt: number;
}

export interface SessionData {
    id: string;
    title: string;
    workspaceId: string;
    createdAt: number;
    updatedAt: number;
}

// Pi Config (settings panel 用)
export interface PiModelData {
    id: string;
    name: string;
    provider: string;
    providerName: string;
    description: string;
    maxTokens?: number;
}

export interface PiConfigData {
    models: PiModelData[];
    currentModel?: {
        model: string;
        provider: string;
    } | null;
}

// ── Messaging Gateway Types 已删除 (v1.0.10 L4) ──
// v1.0.1 hotfix 已砍 IM bridge, GatewayPlatform / PlatformMessage / PlatformStatus /
// GatewayConfig 在源码中无任何外部引用, 留在这里会误导后来人误以为还有 IM 功能.
// 若以后真要重新引入 IM 桥, 从 git history 取回即可.

// PiAPI / NodeAPI / Window — 全部从 @shared 来, 这里不再重复声明.
// 若需要扩展 renderer 独有字段, 用 interface merge:
//   import type { PiAPI as SharedPiAPI } from "@shared";
//   export interface PiAPI extends SharedPiAPI { ... }
export type { PiAPI, NodeAPI, Unsubscribe } from "@shared";

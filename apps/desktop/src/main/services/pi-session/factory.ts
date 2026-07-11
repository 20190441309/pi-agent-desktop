// AgentSession Factory (M1 Task 5)
// 为每个 workspace 创建一个 Pi AgentSession 实例
// 不起子进程, 直接 in-process 调用

import { createRequire } from "module";
import { existsSync } from "fs";
import { dirname, join } from "path";
import log from "electron-log/main";
import type {
    AgentSession,
    AuthStorage,
    ExtensionUIContext,
    ModelRegistry,
    ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type { PiAgentConfig } from "../../types";
import { createGuardedBuiltins } from "../permission/guarded-tools";
import type { RuntimeToolPolicy } from "../permission/runtime-policy";
import { loadPiSdk } from "./sdk-runtime";

const require = createRequire(__filename);
type RegisteredProviderConfig = Parameters<ModelRegistry["registerProvider"]>[1];
type RegisteredApi = RegisteredProviderConfig["api"];

export interface WorkspaceSession {
    workspaceId: string;
    session: AgentSession;
    dispose: () => void;
}

export interface DesktopExtensionCapabilityOptions {
    planModeEnabled?: boolean;
    composeModeEnabled?: boolean;
    workflowEnabled?: boolean;
    composeWorkflowEnabled?: boolean;
}

export interface CreateSessionOpts {
    workspaceId: string;
    workspacePath: string;
    modelId?: string;
    provider?: string;
    agentDir?: string;
    piAgentConfig?: PiAgentConfig | null;
    sessionPath?: string;
    uiContext?: ExtensionUIContext;
    tools?: string[];
    noTools?: "all" | "builtin";
    customTools?: ToolDefinition[];
    getRuntimePolicy?: () => RuntimeToolPolicy;
    desktopExtensions?: string[];
}

type SendUserMessageFn = AgentSession["sendUserMessage"];

export async function createWorkspaceSession(opts: CreateSessionOpts): Promise<WorkspaceSession> {
    const sdk = await loadPiSdk();
    const agentDir = opts.agentDir ?? sdk.getAgentDir();
    const authStorage = sdk.AuthStorage.create(join(agentDir, "auth.json"));
    const modelRegistry = sdk.ModelRegistry.create(authStorage, join(agentDir, "models.json"));
    await registerConfiguredProviders(modelRegistry, authStorage, opts.piAgentConfig, opts.provider);
    const selectedModel = opts.provider && opts.modelId
        ? modelRegistry.find(opts.provider, opts.modelId)
        : undefined;
    const settingsManager = sdk.SettingsManager.create(opts.workspacePath, agentDir);
    const additionalExtensionPaths = resolveDesktopExtensionPaths(opts.desktopExtensions);
    const eventBus = sdk.createEventBus();
    const resourceLoader = new sdk.DefaultResourceLoader({
        cwd: opts.workspacePath,
        agentDir,
        eventBus,
        settingsManager,
        additionalExtensionPaths,
    });
    await resourceLoader.reload();
    const customTools = opts.getRuntimePolicy
        ? [...(opts.customTools ?? []), ...createGuardedBuiltins(opts.workspacePath, opts.getRuntimePolicy)]
        : opts.customTools;

    const { session } = await sdk.createAgentSession({
        cwd: opts.workspacePath,
        agentDir,
        authStorage,
        modelRegistry,
        settingsManager,
        model: selectedModel,
        tools: opts.tools,
        noTools: opts.noTools,
        customTools,
        resourceLoader,
        sessionManager: opts.sessionPath ? sdk.SessionManager.open(opts.sessionPath) : undefined,
    });
    patchExtensionSendUserMessage(session);
    if (opts.uiContext) {
        await session.bindExtensions({ uiContext: opts.uiContext });
    }

    return {
        workspaceId: opts.workspaceId,
        session,
        dispose: () => {
            try {
                session.dispose();
            } catch (err) {
                log.warn("[factory] session dispose error:", err);
            }
        },
    };
}

function patchExtensionSendUserMessage(session: AgentSession): void {
    const target = session as AgentSession & {
        isStreaming?: boolean;
        sendUserMessage?: SendUserMessageFn;
        __piDesktopPatchedSendUserMessage?: boolean;
    };
    if (target.__piDesktopPatchedSendUserMessage) return;
    if (typeof target.sendUserMessage !== "function") return;
    const original = target.sendUserMessage.bind(session) as SendUserMessageFn;
    target.sendUserMessage = (async (content, options) => {
        if (options?.deliverAs) {
            await original(content, options);
            return;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (target.isStreaming) {
            await original(content, { deliverAs: "followUp" });
            return;
        }
        await original(content, options);
    }) as SendUserMessageFn;
    target.__piDesktopPatchedSendUserMessage = true;
}

function safeResolve(packageName: string, map: (resolved: string) => string = (resolved) => resolved): string | undefined {
    try {
        return map(require.resolve(packageName));
    } catch {
        return undefined;
    }
}

export function resolveBundledDesktopExtensionPaths(
    options: DesktopExtensionCapabilityOptions = {},
): string[] {
    const paths: Array<string | undefined> = [];
    if (options.planModeEnabled) {
        paths.push(safeResolve("pi-openplan/package.json", (packageJson) => dirname(packageJson)));
    }
    if (options.composeModeEnabled) {
        paths.push(resolveBundledComposeExtensionPath());
    }
    if (options.workflowEnabled || options.composeWorkflowEnabled) {
        paths.push(resolveBundledComposeExtensionPath(__dirname, "workflow-extension.ts"));
    }
    return [...new Set(paths.filter((path): path is string => Boolean(path)))];
}

export function resolveBundledComposeExtensionPath(baseDir = __dirname, entryFile = "index.ts"): string | undefined {
    const candidates = [
        join(baseDir, "../../../../extensions/compose-mode", entryFile),
        join(baseDir, "../../../extensions/compose-mode", entryFile),
        join(baseDir, "../../extensions/compose-mode", entryFile),
    ];
    return candidates.find((candidate) => existsSync(candidate));
}

function resolveDesktopExtensionPaths(explicitDesktopExtensions?: string[]): string[] {
    const paths = [
        safeResolve("pi-permission-system"),
        ...(explicitDesktopExtensions ?? []),
    ].filter((path): path is string => Boolean(path));
    return [...new Set(paths)];
}

async function registerConfiguredProviders(
    modelRegistry: ModelRegistry,
    authStorage: AuthStorage,
    config?: PiAgentConfig | null,
    selectedProvider?: string,
): Promise<void> {
    for (const provider of config?.providers ?? []) {
        if (selectedProvider && provider.id !== selectedProvider) continue;
        if (!provider.baseUrl || provider.models.length === 0) continue;
        const apiKey = await authStorage.getApiKey(provider.id) ?? resolveProviderApiKey(provider.apiKey);
        if (!apiKey) continue;
        modelRegistry.registerProvider(provider.id, {
            name: provider.name,
            baseUrl: provider.baseUrl,
            apiKey,
            api: toApi(provider.api),
            models: provider.models.map((model) => ({
                id: model.id,
                name: model.name,
                api: toApi(provider.api),
                reasoning: model.reasoning ?? false,
                input: normalizeModelInput(model.input),
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: model.contextWindow ?? 128000,
                maxTokens: model.maxTokens ?? 16384,
            })),
        });
    }
}

function resolveProviderApiKey(apiKey?: string): string | undefined {
    const trimmed = apiKey?.trim();
    if (!trimmed) return undefined;
    return process.env[trimmed] || trimmed;
}

function normalizeModelInput(input?: string[]): Array<"text" | "image"> {
    const normalized = (input ?? ["text"]).filter((item): item is "text" | "image" => item === "text" || item === "image");
    return normalized.length > 0 ? normalized : ["text"];
}

function toApi(api?: string): RegisteredApi {
    return api as RegisteredApi;
}

import { ipcMain } from "electron";
import { ipcError, type CreateAgentInput, type PiThinkingLevel, type SendAgentPromptInput } from "@shared";
import type { AgentRuntimeRegistry } from "../services/agent-runtime/registry";
import { agentsCreateSchema, agentsPromptSchema, agentsIdSchema, agentsSetThinkingSchema } from "./schemas";

export function setupAgentsIpc(registry: AgentRuntimeRegistry): void {
    ipcMain.handle("agents:list", async () => registry.list());
    ipcMain.handle("agents:create", async (_event, input: CreateAgentInput) => {
        agentsCreateSchema.parse(input);
        return registry.create(input);
    });
    ipcMain.handle("agents:prompt", async (_event, input: SendAgentPromptInput) => {
        agentsPromptSchema.parse(input);
        return registry.prompt(input);
    });
    ipcMain.handle("agents:abort", async (_event, agentId: string) => {
        agentsIdSchema.parse([agentId]);
        return registry.abort(agentId);
    });
    ipcMain.handle("agents:stop", async (_event, agentId: string) => {
        agentsIdSchema.parse([agentId]);
        return registry.stop(agentId);
    });
    ipcMain.handle("agents:restart", async (_event, agentId: string) => {
        agentsIdSchema.parse([agentId]);
        return registry.restart(agentId);
    });
    ipcMain.handle("agents:messages", async (_event, agentId: string) => {
        agentsIdSchema.parse([agentId]);
        return registry.getMessages(agentId);
    });
    ipcMain.handle("agents:runtime-state", async (_event, agentId: string) => {
        agentsIdSchema.parse([agentId]);
        return registry.getRuntimeState(agentId);
    });
    ipcMain.handle("agents:set-thinking", async (_event, agentId: string, level: PiThinkingLevel) => {
        const parsed = agentsSetThinkingSchema.safeParse([agentId, level]);
        if (!parsed.success) {
            return ipcError("ipcErrors.agents.invalidThinkingLevel", "无效的思考强度");
        }
        try {
            return registry.setThinking(agentId, level);
        } catch (error) {
            return ipcError(
                "ipcErrors.agents.setThinkingFailed",
                error instanceof Error ? error.message : String(error),
            );
        }
    });
    ipcMain.handle("agents:sync-permissions", async (_event, agentId: string) => {
        const parsed = agentsIdSchema.safeParse([agentId]);
        if (!parsed.success) {
            return ipcError("ipcErrors.agents.invalidAgentId", "agentId must be a non-empty string");
        }
        try {
            return await registry.syncPermissions(agentId);
        } catch (error) {
            return ipcError(
                "ipcErrors.agents.syncPermissionsFailed",
                error instanceof Error ? error.message : String(error),
            );
        }
    });
}

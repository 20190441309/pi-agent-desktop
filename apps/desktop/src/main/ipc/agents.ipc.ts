import { ipcMain } from "electron";
import type { CreateAgentInput, SendAgentPromptInput } from "@shared";
import type { AgentRuntimeRegistry } from "../services/agent-runtime/registry";
import { agentsCreateSchema, agentsPromptSchema, agentsIdSchema } from "./schemas";

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
}

import type { PiThinkingLevel } from "@shared";

export interface PiAgentModel {
  id: string;
  name: string;
  provider: string;
  providerName: string;
  api?: string;
  baseUrl?: string;
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: boolean;
  input?: string[];
  thinkingLevelMap?: Partial<Record<PiThinkingLevel, string | null>>;
  headers?: Record<string, string>;
  compat?: Record<string, unknown>;
  cost?: Partial<Record<"input" | "output" | "cacheRead" | "cacheWrite", number>>;
}

export interface PiAgentProvider {
  id: string;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  apiType?: string;
  api?: string;
  headers?: Record<string, string>;
  authHeader?: boolean;
  _piDesktopDeletedModels?: string[];
  models: PiAgentModel[];
}

export interface PiAgentConfig {
  defaultProvider: string;
  defaultModel: string;
  providers: PiAgentProvider[];
}

// Gateway Store - 消息网关状态管理
// 管理微信/飞书/QQ 等平台的消息网关连接和消息

import { create } from 'zustand';
import type { PlatformMessage, PlatformStatus, GatewayPlatform } from '../types';

// Helper: check if gateway API is available
function getGatewayAPI(): Record<string, (...args: unknown[]) => Promise<unknown>> | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const piAPI = (window as any).piAPI;
  if (piAPI && typeof piAPI.gatewayStatus === 'function') {
    return piAPI as Record<string, (...args: unknown[]) => Promise<unknown>>;
  }
  return null;
}

interface GatewayState {
  statuses: PlatformStatus[];
  messages: PlatformMessage[];
  currentPlatform: GatewayPlatform | null;
  isLoading: boolean;
  newMessageCount: number;

  // Actions
  refreshStatus: () => Promise<void>;
  connect: (platform: string) => Promise<void>;
  disconnect: (platform: string) => Promise<void>;
  sendMessage: (platform: string, chatId: string, content: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  addMessage: (msg: PlatformMessage) => void;
  setCurrentPlatform: (platform: GatewayPlatform | null) => void;
  clearNewMessageCount: () => void;
}

export const useGatewayStore = create<GatewayState>((set, get) => ({
  statuses: [],
  messages: [],
  currentPlatform: null,
  isLoading: false,
  newMessageCount: 0,

  refreshStatus: async () => {
    const api = getGatewayAPI();
    if (!api) return;
    try {
      set({ isLoading: true });
      const statuses = (await api.gatewayStatus()) as PlatformStatus[];
      set({ statuses, isLoading: false });
    } catch (err) {
      console.warn('[Gateway] refreshStatus failed:', err);
      set({ isLoading: false });
    }
  },

  connect: async (platform: string) => {
    const api = getGatewayAPI();
    if (!api) return;
    try {
      await api.gatewayConnect(platform);
      // Refresh status after connecting
      await get().refreshStatus();
    } catch (err) {
      console.warn(`[Gateway] connect(${platform}) failed:`, err);
    }
  },

  disconnect: async (platform: string) => {
    const api = getGatewayAPI();
    if (!api) return;
    try {
      await api.gatewayDisconnect(platform);
      await get().refreshStatus();
    } catch (err) {
      console.warn(`[Gateway] disconnect(${platform}) failed:`, err);
    }
  },

  sendMessage: async (platform: string, chatId: string, content: string) => {
    const api = getGatewayAPI();
    if (!api) return;
    try {
      await api.gatewaySend(platform, chatId, content);
    } catch (err) {
      console.warn(`[Gateway] sendMessage failed:`, err);
    }
  },

  loadMessages: async () => {
    const api = getGatewayAPI();
    if (!api) return;
    try {
      set({ isLoading: true });
      const messages = (await api.gatewayMessages()) as PlatformMessage[];
      set({ messages, isLoading: false });
    } catch (err) {
      console.warn('[Gateway] loadMessages failed:', err);
      set({ isLoading: false });
    }
  },

  addMessage: (msg: PlatformMessage) => {
    set((state) => {
      // Deduplicate by id
      if (state.messages.some((m) => m.id === msg.id)) return state;
      const messages = [...state.messages, msg].sort((a, b) => a.timestamp - b.timestamp);
      // Keep last 500 messages
      const trimmed = messages.length > 500 ? messages.slice(-500) : messages;
      return {
        messages: trimmed,
        newMessageCount: state.newMessageCount + 1,
      };
    });
  },

  setCurrentPlatform: (platform: GatewayPlatform | null) => {
    set({ currentPlatform: platform });
  },

  clearNewMessageCount: () => {
    set({ newMessageCount: 0 });
  },
}));

/**
 * 初始化网关实时消息监听。
 * 应在 GatewayPanel 挂载时调用一次。
 * 返回清理函数。
 */
export function initGatewayListener(): () => void {
  const api = getGatewayAPI();
  if (!api || typeof api.onGatewayMessage !== 'function') {
    return () => {};
  }
  const unsub = api.onGatewayMessage((msg: PlatformMessage) => {
    useGatewayStore.getState().addMessage(msg);
  });
  return typeof unsub === 'function' ? unsub : () => {};
}

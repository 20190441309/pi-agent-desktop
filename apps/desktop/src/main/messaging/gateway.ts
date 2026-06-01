// Messaging gateway (M6-1 STUB)
// 完整实现推迟到 v1.1+ (扫码登录 + 消息轮询 + 自动回复)
//
// v1.0: stub 类, 所有方法 no-op, 不连真实 IM 平台.

import { EventEmitter } from "events";
import type { BrowserWindow } from "electron";
import type { GatewayConfig, PlatformStatus, PlatformMessage } from "./types";

export class MessagingGateway extends EventEmitter {
    constructor(_config: GatewayConfig) {
        super();
    }

    setMainWindow(_window: BrowserWindow): void {
        // v1.0: no-op
    }

    async connectPlatform(_platform: string): Promise<PlatformStatus> {
        return { platform: "wechat", connected: false, messageCount: 0 };
    }

    async disconnectPlatform(_platform: string): Promise<void> {
        // v1.0: no-op
    }

    async sendReply(_platform: string, _chatId: string, _content: string): Promise<void> {
        // v1.0: no-op
    }

    getStatus(): PlatformStatus[] {
        return [];
    }

    getMessageHistory(): PlatformMessage[] {
        return [];
    }

    async updateConfig(_config: Partial<GatewayConfig>): Promise<void> {
        // v1.0: no-op
    }

    destroy(): void {
        this.removeAllListeners();
    }
}

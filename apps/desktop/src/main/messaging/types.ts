// Messaging gateway types (M6-1 STUB)
// 完整实现推迟到 v1.1+ (微信/飞书/QQ 适配)
//
// v1.0: 定义类型, 实例化 stub, 不连真实 IM 平台.

export interface GatewayConfig {
    wechat: { enabled: boolean; appId?: string; appSecret?: string };
    feishu: { enabled: boolean; appId?: string; appSecret?: string };
    qq: { enabled: boolean; appId?: string; appSecret?: string };
    autoReply: boolean;
    replyMode: "pi" | "echo";
}

export interface PlatformStatus {
    platform: "wechat" | "feishu" | "qq";
    connected: boolean;
    accountName?: string;
    lastMessageAt?: number;
    messageCount: number;
    error?: string;
}

export interface PlatformMessage {
    id: string;
    platform: "wechat" | "feishu" | "qq";
    chatId: string;
    senderName: string;
    content: string;
    timestamp: number;
    direction: "in" | "out";
    replied: boolean;
}

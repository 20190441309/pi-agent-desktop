// 微信 iLink 协议适配器
// 需要安装 @tencent-weixin/openclaw-weixin，当前为 stub 实现

import { PlatformConfig, PlatformMessage, PlatformStatus } from '../types';
import { EventEmitter } from 'events';

export class WechatAdapter extends EventEmitter {
  name = '微信';
  platform = 'wechat' as const;
  isConnected = false;
  private messageCount = 0;
  private lastMessageAt?: number;

  async connect(_config: PlatformConfig): Promise<void> {
    // TODO: 初始化 iLink 连接
    // const { createBot } = require('@tencent-weixin/openclaw-weixin');
    // this.bot = createBot({ appId, appSecret, ... });
    // this.bot.on('message', (raw: any) => { ... });
    // await this.bot.connect();
    this.isConnected = true;
    console.log('[WeChat] Connected (stub)');
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    console.log('[WeChat] Disconnected');
  }

  async sendMessage(chatId: string, content: string): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected');
    // TODO: 通过 iLink 发送消息
    // await this.bot.sendText(chatId, content);
    console.log(`[WeChat] Send to ${chatId}: ${content.substring(0, 50)}`);
  }

  onMessage(_callback: (msg: PlatformMessage) => void): void {
    // TODO: 当真实 SDK 接入时，将 callback 传递给消息处理
    void _callback;
  }

  getStatus(): PlatformStatus {
    return {
      platform: this.platform,
      connected: this.isConnected,
      messageCount: this.messageCount,
      lastMessageAt: this.lastMessageAt,
    };
  }
}

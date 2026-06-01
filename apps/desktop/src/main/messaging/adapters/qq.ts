// QQ 官方机器人适配器
// 使用 QQ 开放平台 API

import { PlatformConfig, PlatformMessage, PlatformStatus } from '../types';
import { EventEmitter } from 'events';
import https from 'https';

export class QQAdapter extends EventEmitter {
  name = 'QQ';
  platform = 'qq' as const;
  isConnected = false;
  private messageCallback?: (msg: PlatformMessage) => void;
  private messageCount = 0;
  private lastMessageAt?: number;
  private accessToken?: string;

  async connect(config: PlatformConfig): Promise<void> {
    // 获取 access_token
    if (config.appId && config.appSecret) {
      await this.getAccessToken(config.appId, config.appSecret);
    }
    this.isConnected = true;
    console.log('[QQ] Connected');
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.accessToken = undefined;
    console.log('[QQ] Disconnected');
  }

  async sendMessage(chatId: string, content: string): Promise<void> {
    if (!this.isConnected || !this.accessToken) {
      throw new Error('Not connected');
    }
    // QQ 机器人 API 发送消息
    const body = JSON.stringify({
      content,
      msg_type: 0, // 文本
    });
    await this.apiRequest('POST', `/api/v2/groups/${chatId}/messages`, body);
  }

  onMessage(callback: (msg: PlatformMessage) => void): void {
    this.messageCallback = callback;
  }

  getStatus(): PlatformStatus {
    return {
      platform: this.platform,
      connected: this.isConnected,
      messageCount: this.messageCount,
      lastMessageAt: this.lastMessageAt,
    };
  }

  private async getAccessToken(appId: string, appSecret: string): Promise<void> {
    const body = JSON.stringify({
      appId,
      clientSecret: appSecret,
    });
    const result = await this.apiRequest('POST', '/api/v2/oauth2/token', body);
    const data = JSON.parse(result);
    this.accessToken = data.access_token;
  }

  private apiRequest(method: string, path: string, body?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.sgroup.qq.com',
        path,
        method,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => data += chunk.toString());
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  // 处理 QQ 事件回调
  handleWebhookEvent(event: any): void {
    if (event.content) {
      this.messageCount++;
      this.lastMessageAt = Date.now();
      const msg: PlatformMessage = {
        id: event.id || Date.now().toString(),
        platform: 'qq',
        chatId: event.group_id || event.channel_id || '',
        chatName: event.group_name || event.channel_name || '',
        chatType: event.group_id ? 'group' : 'private',
        senderId: event.author?.id || '',
        senderName: event.author?.username || '',
        content: event.content || '',
        contentType: 'text',
        timestamp: Date.now(),
        raw: event,
      };
      this.messageCallback?.(msg);
      this.emit('message', msg);
    }
  }
}

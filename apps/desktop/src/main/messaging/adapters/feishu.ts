// 飞书 Bot API 适配器
// 使用飞书 Open API 接收和发送消息

import { PlatformConfig, PlatformMessage, PlatformStatus } from '../types';
import { EventEmitter } from 'events';
import https from 'https';

export class FeishuAdapter extends EventEmitter {
  name = '飞书';
  platform = 'feishu' as const;
  isConnected = false;
  private messageCallback?: (msg: PlatformMessage) => void;
  private messageCount = 0;
  private lastMessageAt?: number;
  private tenantAccessToken?: string;

  async connect(config: PlatformConfig): Promise<void> {
    // 获取 tenant_access_token
    if (config.appId && config.appSecret) {
      await this.getAccessToken(config.appId, config.appSecret);
    }
    this.isConnected = true;
    console.log('[Feishu] Connected');
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.tenantAccessToken = undefined;
    console.log('[Feishu] Disconnected');
  }

  async sendMessage(chatId: string, content: string): Promise<void> {
    if (!this.isConnected || !this.tenantAccessToken) {
      throw new Error('Not connected');
    }
    const body = JSON.stringify({
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text: content }),
    });
    await this.apiRequest('POST', '/open-apis/im/v1/messages', body, {
      'Authorization': `Bearer ${this.tenantAccessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    });
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
    const body = JSON.stringify({ app_id: appId, app_secret: appSecret });
    const result = await this.apiRequest('POST', '/open-apis/auth/v3/tenant_access_token/internal', body, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    const data = JSON.parse(result);
    this.tenantAccessToken = data.tenant_access_token;
  }

  private apiRequest(method: string, path: string, body?: string, headers?: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'open.feishu.cn',
        path,
        method,
        headers: headers || {},
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

  // 处理飞书事件回调（需要 HTTP 服务器接收 webhook）
  handleWebhookEvent(event: any): void {
    if (event.msg_type === 'text') {
      this.messageCount++;
      this.lastMessageAt = Date.now();
      const msg: PlatformMessage = {
        id: event.message_id || Date.now().toString(),
        platform: 'feishu',
        chatId: event.chat_id || '',
        chatName: event.chat_type || '',
        chatType: event.chat_type === 'p2p' ? 'private' : 'group',
        senderId: event.sender_id?.user_id || '',
        senderName: event.sender_id?.user_id || '',
        content: typeof event.text === 'string' ? event.text : '',
        contentType: 'text',
        timestamp: Date.now(),
        raw: event,
      };
      this.messageCallback?.(msg);
      this.emit('message', msg);
    }
  }
}

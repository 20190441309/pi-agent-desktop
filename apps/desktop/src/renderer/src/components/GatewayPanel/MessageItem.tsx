// MessageItem - 消息项组件
//
// 显示单条消息：发送者、内容、时间、平台标识、私聊/群聊标识

import React from 'react';
import type { PlatformMessage } from '../../types';

const PLATFORM_COLORS: Record<string, string> = {
  wechat: '#07c160',
  feishu: '#3370ff',
  qq: '#12b7f5',
};

const PLATFORM_LABELS: Record<string, string> = {
  wechat: '微信',
  feishu: '飞书',
  qq: 'QQ',
};

function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + time;
}

interface MessageItemProps {
  message: PlatformMessage;
}

export function MessageItem({ message }: MessageItemProps): React.JSX.Element {
  const platformColor = PLATFORM_COLORS[message.platform] || '#999999';
  const platformLabel = PLATFORM_LABELS[message.platform] || message.platform;

  return (
    <div className="flex gap-2.5 px-3 py-2 hover:bg-[#fafafa] rounded-lg transition-colors group">
      {/* 头像占位 */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
        style={{ backgroundColor: platformColor }}
      >
        {message.senderName.charAt(0).toUpperCase()}
      </div>

      {/* 消息内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium text-[#1a1a1a]">{message.senderName}</span>
          {/* 平台标识 */}
          <span
            className="text-[10px] px-1 py-0 rounded"
            style={{ backgroundColor: platformColor + '18', color: platformColor }}
          >
            {platformLabel}
          </span>
          {/* 私聊/群聊标识 */}
          <span className="text-[10px] text-[#999999]">
            {message.chatType === 'group' ? '群聊' : '私聊'}
          </span>
          {message.chatType === 'group' && (
            <span className="text-[10px] text-[#cccccc]">{message.chatName}</span>
          )}
          {/* 时间 */}
          <span className="text-[10px] text-[#cccccc] ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(message.timestamp)}
          </span>
        </div>

        {/* 消息正文 */}
        <div className="text-xs text-[#333333] leading-relaxed break-words">
          {message.contentType === 'text' ? (
            message.content
          ) : message.contentType === 'image' ? (
            <span className="text-[#999999] italic">[图片]</span>
          ) : message.contentType === 'file' ? (
            <span className="text-[#999999] italic">[文件] {message.content}</span>
          ) : message.contentType === 'voice' ? (
            <span className="text-[#999999] italic">[语音]</span>
          ) : (
            message.content
          )}
        </div>
      </div>
    </div>
  );
}

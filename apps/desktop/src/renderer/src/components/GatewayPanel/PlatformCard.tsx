// PlatformCard - 平台状态卡片
//
// 显示单个平台（微信/飞书/QQ）的连接状态、消息数、连接/断开操作

import React from 'react';
import type { PlatformStatus } from '../../types';

const PLATFORM_CONFIG: Record<string, { name: string; color: string; icon: string }> = {
  wechat: { name: '微信', color: '#07c160', icon: '💬' },
  feishu: { name: '飞书', color: '#3370ff', icon: '🐦' },
  qq: { name: 'QQ', color: '#12b7f5', icon: '🐧' },
};

interface PlatformCardProps {
  status: PlatformStatus;
  isActive: boolean;
  onConnect: (platform: string) => void;
  onDisconnect: (platform: string) => void;
  onClick: () => void;
}

export function PlatformCard({
  status,
  isActive,
  onConnect,
  onDisconnect,
  onClick,
}: PlatformCardProps): React.JSX.Element {
  const config = PLATFORM_CONFIG[status.platform] || {
    name: status.platform,
    color: '#999999',
    icon: '📱',
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border ${
        isActive
          ? 'border-[#1a1a1a] bg-[#f5f5f5]'
          : 'border-transparent hover:bg-[#fafafa]'
      }`}
    >
      {/* 平台图标 */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: config.color + '18' }}
      >
        {config.icon}
      </div>

      {/* 平台信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[#1a1a1a]">{config.name}</span>
          {/* 连接状态点 */}
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              status.connected ? 'bg-[#10b981]' : 'bg-[#999999]'
            }`}
          />
        </div>
        <div className="text-xs text-[#999999] truncate">
          {status.error ? (
            <span className="text-[#ef4444]">{status.error}</span>
          ) : status.connected ? (
            <span>{status.accountName || '已连接'} · {status.messageCount} 条消息</span>
          ) : (
            <span>未连接</span>
          )}
        </div>
      </div>

      {/* 连接/断开按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (status.connected) {
            onDisconnect(status.platform);
          } else {
            onConnect(status.platform);
          }
        }}
        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
          status.connected
            ? 'bg-white border border-[#e5e5e5] text-[#666] hover:bg-[#f0f0f0] hover:border-[#ccc]'
            : 'text-white hover:opacity-90'
        }`}
        style={!status.connected ? { backgroundColor: config.color } : undefined}
      >
        {status.connected ? '断开' : '连接'}
      </button>
    </div>
  );
}

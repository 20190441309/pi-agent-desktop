// GatewayPanel - 消息网关面板
//
// 显示各平台连接状态、消息列表，支持平台切换和消息发送

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useGatewayStore, initGatewayListener } from '../../stores/gateway-store';
import { PlatformCard } from './PlatformCard';
import { MessageItem } from './MessageItem';
import type { GatewayPlatform, PlatformStatus } from '../../types';

const PLATFORMS: GatewayPlatform[] = ['wechat', 'feishu', 'qq'];

const PLATFORM_LABELS: Record<GatewayPlatform, string> = {
  wechat: '微信',
  feishu: '飞书',
  qq: 'QQ',
};

const PLATFORM_COLORS: Record<GatewayPlatform, string> = {
  wechat: '#07c160',
  feishu: '#3370ff',
  qq: '#12b7f5',
};

interface GatewayPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function GatewayPanel({ isOpen, onToggle }: GatewayPanelProps): React.JSX.Element {
  const {
    statuses,
    messages,
    currentPlatform,
    isLoading,
    refreshStatus,
    connect,
    disconnect,
    sendMessage,
    loadMessages,
    setCurrentPlatform,
    clearNewMessageCount,
  } = useGatewayStore();

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize real-time listener
  useEffect(() => {
    if (!isOpen) return;
    const cleanup = initGatewayListener();
    refreshStatus();
    loadMessages();
    clearNewMessageCount();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Filtered messages for current platform
  const filteredMessages = useMemo(() => {
    if (!currentPlatform) return messages;
    return messages.filter((m) => m.platform === currentPlatform);
  }, [messages, currentPlatform]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages.length]);

  // Get status for a platform
  const getStatus = useCallback(
    (platform: string): PlatformStatus => {
      return (
        statuses.find((s) => s.platform === platform) || {
          platform,
          connected: false,
          messageCount: 0,
        }
      );
    },
    [statuses]
  );

  // Count connected platforms
  const connectedCount = statuses.filter((s) => s.connected).length;

  // Handle send
  const handleSend = useCallback(() => {
    const content = inputValue.trim();
    if (!content || !currentPlatform) return;
    // Find a chat to send to (use the most recent message's chatId for this platform)
    const lastMsg = [...filteredMessages].reverse().find((m) => m.platform === currentPlatform);
    if (lastMsg) {
      sendMessage(currentPlatform, lastMsg.chatId, content);
      setInputValue('');
      inputRef.current?.focus();
    }
  }, [inputValue, currentPlatform, filteredMessages, sendMessage]);

  if (!isOpen) return <></>;

  return (
    <div className="w-[420px] flex-shrink-0 bg-[#ffffff] border-l border-[#e5e5e5] flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5e5] bg-[#fafafa]">
        <div className="flex items-center gap-2">
          <span className="text-base">🌐</span>
          <h2 className="text-sm font-medium text-[#1a1a1a]">消息网关</h2>
          {connectedCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white bg-[#10b981]">
              {connectedCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              refreshStatus();
              loadMessages();
            }}
            className="p-1 rounded hover:bg-[#e5e5e5] transition-colors text-[#999999]"
            title="刷新"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-[#e5e5e5] transition-colors text-[#999999]"
            title="关闭面板"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 平台 Tab 切换 */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[#e5e5e5]">
        <button
          onClick={() => setCurrentPlatform(null)}
          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
            currentPlatform === null
              ? 'bg-[#1a1a1a] text-white'
              : 'text-[#666] hover:bg-[#f0f0f0]'
          }`}
        >
          全部
        </button>
        {PLATFORMS.map((p) => {
          const st = getStatus(p);
          return (
            <button
              key={p}
              onClick={() => setCurrentPlatform(p)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                currentPlatform === p
                  ? 'text-white'
                  : 'text-[#666] hover:bg-[#f0f0f0]'
              }`}
              style={
                currentPlatform === p
                  ? { backgroundColor: PLATFORM_COLORS[p] }
                  : undefined
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  st.connected ? 'bg-[#10b981]' : 'bg-[#999999]'
                }`}
              />
              {PLATFORM_LABELS[p]}
            </button>
          );
        })}
      </div>

      {/* 平台状态卡片区域 */}
      <div className="px-3 py-2 space-y-1 border-b border-[#e5e5e5] bg-[#fafafa]">
        {(currentPlatform ? [currentPlatform] : PLATFORMS).map((p) => (
          <PlatformCard
            key={p}
            status={getStatus(p)}
            isActive={currentPlatform === p}
            onConnect={connect}
            onDisconnect={disconnect}
            onClick={() => setCurrentPlatform(currentPlatform === p ? null : p)}
          />
        ))}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="text-3xl mb-2 opacity-30">💬</span>
            <p className="text-sm text-[#999999]">暂无消息</p>
            <p className="text-xs text-[#cccccc] mt-1">
              连接平台后，消息将在此处显示
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => <MessageItem key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部输入框 */}
      <div className="px-3 py-2.5 border-t border-[#e5e5e5] bg-[#fafafa]">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              currentPlatform
                ? `发送到 ${PLATFORM_LABELS[currentPlatform]}...`
                : '选择平台后发送消息...'
            }
            disabled={!currentPlatform}
            className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#e5e5e5] rounded-md outline-none focus:border-[#999] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!currentPlatform || !inputValue.trim()}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: currentPlatform
                ? PLATFORM_COLORS[currentPlatform]
                : '#999999',
            }}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

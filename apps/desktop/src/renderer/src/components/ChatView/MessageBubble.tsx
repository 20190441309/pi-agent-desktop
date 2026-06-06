// 消息气泡 - v2.0 MiniMax Code 风格
// AI 消息: 白底圆角卡片 + 底部复制/时间戳
// 用户消息: 浅色 pill + normal 字重

import React, { useState, useCallback } from 'react';
import { Message } from '../../stores/session-store';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CommandCard } from './CommandCard';
import { ThinkingBlock } from './ThinkingBlock';
import { useI18n } from '../../i18n';
import { formatTime, formatIso } from '../../utils/format';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps): React.JSX.Element {
  const { t } = useI18n();
  const isUser = message.role === 'user';
  const timeText = formatTime(message.timestamp);
  const timeIso = formatIso(message.timestamp);
  const authorLabel = isUser ? t('messageBubble.userAuthor') : t('messageBubble.piAuthor');
  const articleLabel = `${authorLabel} · ${timeText}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!message.content) return;
    void navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  return (
    <article
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      role="article"
      aria-label={articleLabel}
      aria-busy={isStreaming}
    >
      <div className={isUser ? 'max-w-[74%]' : 'w-full max-w-full'}>
          <div className={`${
            isUser
              ? 'rounded-2xl bg-[#f5f5f5] px-4 py-3 text-[#1f1f1f]'
              : 'rounded-xl bg-white px-4 py-3 text-[#1f1f1f]'
          }`}>
            {isUser ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed font-normal">{message.content}</div>
            ) : (
              <>
                {message.thinking && (
                  <ThinkingBlock
                    content={message.thinking}
                    isStreaming={isStreaming && !message.content}
                  />
                )}

                {message.content && (
                  <div className="text-sm leading-relaxed font-normal">
                    <MarkdownRenderer content={message.content} />
                  </div>
                )}

                {isStreaming && !message.content && !message.thinking && (
                  <div className="flex items-center gap-2 py-1" aria-hidden="true">
                    <span className="inline-block w-0.5 h-4 bg-[#1a1a1a] animate-pulse" />
                  </div>
                )}
              </>
            )}

            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className={`space-y-2 ${isUser ? 'mt-3' : 'mt-4'}`}>
                {message.toolCalls.map((toolCall) => (
                  <CommandCard key={toolCall.id} toolCall={toolCall} />
                ))}
              </div>
            )}

            {/* 底部栏: 复制 + 时间戳 */}
            <div className={`flex items-center gap-2 mt-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && message.content && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-[#aaa] hover:text-[#666] transition-colors"
                  aria-label={copied ? "已复制" : "复制内容"}
                  title={copied ? "已复制" : "复制"}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {copied ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    )}
                  </svg>
                </button>
              )}
              <time dateTime={timeIso} className="text-xs text-[#aaa]">
                {timeText}
              </time>
            </div>
          </div>
      </div>
    </article>
  );
}

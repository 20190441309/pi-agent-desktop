// 消息气泡 - v2.0 MiniMax Code 风格
// AI 消息: 白底圆角卡片 + 底部复制/时间戳
// 用户消息: 浅色 pill + normal 字重

import React, { useState, useCallback } from 'react';
import { Message } from '../../stores/session-store';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CommandCard } from './CommandCard';
import { CustomMessageCard } from './CustomMessageCard';
import { ThinkingBlock } from './ThinkingBlock';
import { useI18n } from '../../i18n';
import { formatTime, formatIso } from '../../utils/format';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onContinueFrom?: (messageId: string) => void;
}

function describeToolCall(name: unknown): "view" | "modify" | "command" | "tool" {
  if (typeof name !== "string") return "tool";
  const lower = name.toLowerCase();
  if (lower.includes("read") || lower.includes("list") || lower.includes("search") || lower.includes("grep")) return "view";
  if (lower.includes("write") || lower.includes("edit") || lower.includes("patch")) return "modify";
  if (lower.includes("bash") || lower.includes("shell") || lower.includes("command")) return "command";
  return "tool";
}

function countOutputPaths(toolCalls: NonNullable<Message["toolCalls"]>): number {
  const paths = new Set<string>();
  const pattern = /(?:[A-Za-z]:[\\/][^\s"'`<>]+|(?:[\w.-]+[\\/])+[\w.@()[\]-]+\.[A-Za-z0-9_+-]{1,12})/g;
  for (const tc of toolCalls) {
    const text = typeof tc.output === "string" ? tc.output : tc.output == null ? "" : JSON.stringify(tc.output);
    for (const match of text.matchAll(pattern)) {
      paths.add(match[0].replace(/[),.;:]+$/, ""));
    }
  }
  return paths.size;
}

function toolSummary(toolCalls: NonNullable<Message["toolCalls"]>): string {
  const counts = toolCalls.reduce(
    (acc, tc) => {
      acc[describeToolCall(tc.name)] += 1;
      return acc;
    },
    { view: 0, modify: 0, command: 0, tool: 0 },
  );
  const parts: string[] = [];
  if (counts.view > 0) parts.push(`查看 ${counts.view} 个文件`);
  if (counts.modify > 0) parts.push(`修改 ${counts.modify} 个文件`);
  if (counts.command > 0) parts.push(`执行 ${counts.command} 条命令`);
  const outputCount = countOutputPaths(toolCalls);
  if (outputCount > 0) parts.push(`生成 ${outputCount} 个文件`);
  if (counts.tool > 0) parts.push(`使用 ${counts.tool} 个工具`);
  return parts.join("，") || `使用 ${toolCalls.length} 个工具`;
}

function ToolActivity({
  toolCalls,
}: {
  toolCalls: NonNullable<Message["toolCalls"]>;
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const running = toolCalls.some((tc) => tc.status === "running");

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="mt-2 flex w-full items-center justify-between rounded-lg border border-[#eeeeea] bg-[#fbfbfa] px-2.5 py-1.5 text-left text-xs text-[#777] transition-colors hover:border-[#deded9] hover:text-[#333]"
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${running ? "bg-[#f59e0b]" : "bg-[#16a34a]"}`} aria-hidden />
          <span className="truncate">{running ? "处理中" : toolSummary(toolCalls)}</span>
        </span>
        <svg
          className={`ml-2 h-3 w-3 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1">
          {toolCalls.map((toolCall) => (
            <CommandCard key={toolCall.id} toolCall={toolCall} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({ message, isStreaming = false, onContinueFrom }: MessageBubbleProps): React.JSX.Element {
  const { t } = useI18n();
  const isUser = message.role === 'user';
  const timeText = formatTime(message.timestamp);
  const timeIso = formatIso(message.timestamp);
  const authorLabel = isUser ? t('messageBubble.userAuthor') : t('messageBubble.piAuthor');
  const articleLabel = `${authorLabel} · ${timeText}`;
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const handleCopy = useCallback(async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
    } catch (err) {
      setCopied(false);
      setCopyError(`复制失败: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    setCopyError(null);
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
        <div className={`mb-1 flex items-center gap-2 px-1 text-[11px] text-[#9a9a95] ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span>{authorLabel}</span>
          <time dateTime={timeIso}>{timeText}</time>
        </div>
          <div className={`${
            isUser
              ? 'rounded-2xl border border-[#e9e9e5] bg-[#f7f7f4] px-4 py-3 text-[#1f1f1f]'
              : 'rounded-xl border border-[#ececea] bg-white px-4 py-3 text-[#1f1f1f] shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
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

                {message.customCard && (
                  <div className={message.content ? "mt-3" : ""}>
                    <CustomMessageCard card={message.customCard} />
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
              <ToolActivity toolCalls={message.toolCalls} />
            )}

            {/* 底部栏: 复制 + 时间戳 */}
            <div className={`flex items-center gap-2 mt-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {onContinueFrom && !isStreaming && (
                <button
                  type="button"
                  onClick={() => onContinueFrom(message.id)}
                  className="rounded-md px-1.5 py-0.5 text-[11px] text-[#8a8a84] transition-colors hover:bg-[#f1f1ee] hover:text-[#333]"
                  aria-label="从此消息继续"
                  title="从此消息继续"
                >
                  继续
                </button>
              )}
              {!isUser && message.content && (
                <button
                  type="button"
                  onClick={() => void handleCopy()}
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
              {copyError && (
                <span className="text-[11px] text-[#b91c1c]" role="alert">
                  {copyError}
                </span>
              )}
              <time dateTime={timeIso} className="sr-only">
                {timeText}
              </time>
            </div>
          </div>
      </div>
    </article>
  );
}

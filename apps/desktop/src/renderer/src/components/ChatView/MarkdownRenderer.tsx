// MarkdownRenderer (M7-4)
// 轻量 markdown 渲染: 用 react-markdown + rehype-highlight
// 支持代码块高亮 (M2 装的依赖)
// 安全: 不启用 rehypeRaw — 助手/模型内容受外部影响, 渲染原始 HTML 会引入 XSS.
//   CSP (script-src 'self') 已兜底拦截内联脚本, 这里移除 rehypeRaw 做纵深防御.

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
    content: string;
    isStreaming?: boolean;
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content, isStreaming = false }: MarkdownRendererProps): React.ReactElement {
    // 使用 useMemo 缓存渲染结果，避免重复解析相同的 markdown
    const renderedContent = useMemo(() => (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={isStreaming ? [] : [rehypeHighlight]}
        >
            {content}
        </ReactMarkdown>
    ), [content, isStreaming]);

    return (
        <div className="markdown-body max-w-none" data-streaming={isStreaming ? "true" : "false"}>
            {renderedContent}
        </div>
    );
});


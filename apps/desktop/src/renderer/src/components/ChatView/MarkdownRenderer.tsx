// MarkdownRenderer (M7-4)
// 轻量 markdown 渲染: 用 react-markdown + rehype-highlight
// 支持代码块高亮 (M2 装的依赖)

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
    content: string;
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content }: MarkdownRendererProps): React.ReactElement {
    // 使用 useMemo 缓存渲染结果，避免重复解析相同的 markdown
    const renderedContent = useMemo(() => (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeHighlight]}
        >
            {content}
        </ReactMarkdown>
    ), [content]);

    return (
        <div className="markdown-body max-w-none">
            {renderedContent}
        </div>
    );
});


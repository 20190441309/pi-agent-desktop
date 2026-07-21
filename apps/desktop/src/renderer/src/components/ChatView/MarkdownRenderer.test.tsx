// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";

describe("MarkdownRenderer XSS surface (D-023/E-013)", () => {
    it("does not execute raw HTML script tags from untrusted markdown", () => {
        render(
            <MarkdownRenderer content={'Before <script>window.__xss=1</script><img src=x onerror="window.__xss=1"> after'} />,
        );

        // react-markdown without rehype-raw should treat HTML as text or drop unsafe tags,
        // never create a live <script> element.
        expect(document.querySelector("script")).toBeNull();
        expect(document.querySelector("img[onerror]")).toBeNull();
        expect((window as typeof window & { __xss?: number }).__xss).toBeUndefined();
        expect(screen.getByText(/Before/)).toBeTruthy();
    });

    it("renders fenced code blocks as text without interpreting HTML inside them", () => {
        const { container } = render(
            <MarkdownRenderer
                content={[
                    "```html",
                    "<script>alert(1)</script>",
                    "```",
                ].join("\n")}
            />,
        );

        expect(document.querySelector("script")).toBeNull();
        expect(container.querySelector("code")?.textContent ?? "").toContain("<script>alert(1)</script>");
    });

    it("sets data-streaming for streaming mode consumers", () => {
        const { container, rerender } = render(<MarkdownRenderer content="hello" isStreaming />);
        expect(container.querySelector(".markdown-body")?.getAttribute("data-streaming")).toBe("true");
        rerender(<MarkdownRenderer content="hello" isStreaming={false} />);
        expect(container.querySelector(".markdown-body")?.getAttribute("data-streaming")).toBe("false");
    });
});

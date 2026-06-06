// MiniMaxCodeLayout (M1 - 前置)
// MiniMax Code 风格三栏布局壳子 (1:1 还原目标 UI):
//   ┌──────────────────── window title bar (32px) ────────────────────┐
//   │ ┌──────────┐ ┌────────────────────────────┐ ┌──────────┐         │
//   │ │ leftSlot │ │       centerSlot            │ │ rightSlot│         │
//   │ │ 220px    │ │       flex-1                │ │ 280px    │         │
//   │ │ #f7f7f7  │ │       #ffffff               │ │ #ffffff  │         │
//   │ └──────────┘ └────────────────────────────┘ └──────────┘         │
//   └──────────────────────────────────────────────────────────────────┘
// 颜色/尺寸全部走 --mm-* token,本组件不硬编码。
// 不持有任何业务状态:全部由父级传入,layout 只负责排版与占位。
// v2.0: 支持左右栏折叠 + CSS 动画过渡

import React from "react";
import { MiniMaxCodeTitleBar } from "./MiniMaxCodeTitleBar";

export interface MiniMaxCodeLayoutProps {
    /** 左侧栏(任务/技能/历史导航) */
    leftSlot: React.ReactNode;
    /** 主区(对话/内容) */
    centerSlot: React.ReactNode;
    /** 右侧栏(上下文/详情) */
    rightSlot: React.ReactNode;
    /** 左栏是否折叠 */
    leftCollapsed?: boolean;
    /** 右栏是否折叠 */
    rightCollapsed?: boolean;
    /** 折叠左栏回调 */
    onCollapseLeft?: () => void;
    /** 折叠右栏回调 */
    onCollapseRight?: () => void;
    /** 整体容器的额外 className */
    className?: string;
}

export function MiniMaxCodeLayout({
    leftSlot,
    centerSlot,
    rightSlot,
    leftCollapsed = false,
    rightCollapsed = false,
    onCollapseLeft,
    onCollapseRight,
    className = "",
}: MiniMaxCodeLayoutProps): React.JSX.Element {
    return (
        <div
            className={`flex h-screen w-screen flex-col overflow-hidden bg-[var(--mm-bg-main)] text-[var(--mm-text-primary)] ${className}`}
            data-mmcode-layout="root"
        >
            <MiniMaxCodeTitleBar
                title="Pi Agent"
                leftCollapsed={leftCollapsed}
                rightCollapsed={rightCollapsed}
                onToggleLeft={onCollapseLeft}
                onToggleRight={onCollapseRight}
            />

            <div className="flex min-h-0 flex-1 w-full">
                {/* 左侧栏 */}
                <aside
                    className="flex shrink-0 flex-col bg-[var(--mm-bg-sidebar)] animate-layout overflow-hidden"
                    style={{ width: leftCollapsed ? 0 : "var(--mm-width-sidebar-left)", opacity: leftCollapsed ? 0 : 1 }}
                    data-mmcode-region="left"
                    aria-label="primary navigation"
                >
                    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto" style={{ minWidth: leftCollapsed ? 0 : undefined }}>
                        {leftSlot}
                    </div>
                </aside>

                <main
                    className="min-w-0 min-h-0 flex-1 overflow-y-auto bg-[var(--mm-bg-main)]"
                    data-mmcode-region="center"
                    aria-label="main content"
                >
                    {centerSlot}
                </main>

                {/* 右侧栏 */}
                <aside
                    className="flex shrink-0 flex-col bg-[var(--mm-bg-main)] animate-layout overflow-hidden"
                    style={{ width: rightCollapsed ? 0 : "var(--mm-width-sidebar-right)", opacity: rightCollapsed ? 0 : 1 }}
                    data-mmcode-region="right"
                    aria-label="context panel"
                >
                    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto" style={{ minWidth: rightCollapsed ? 0 : undefined }}>
                        {rightSlot}
                    </div>
                </aside>
            </div>
        </div>
    );
}

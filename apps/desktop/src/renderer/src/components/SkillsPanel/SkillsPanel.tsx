// SkillsPanel (M3 Task M3-4)
// 容器: tab 切换 (市场 / 我的) + 搜索 + 创建按钮
// v1.0.14: 3 个 create dropdown 真接通
//  - "用 Pi 构建": 切到 chat + ChatInput prefill skill 草稿提示
//  - "编写技能": 弹 SKILL.md 模板 modal, 写完后复制到剪贴板(纯文本,不接 IPC 写盘)
//  - "GitHub 导入": 调 piAPI.skillsGithubImport(url),显示主进程返回的说明(目前是 git clone 引导)

import React, { useEffect, useState } from "react";
import { SkillsMarketplace } from "./SkillsMarketplace";
import { MySkills } from "./MySkills";
import { SkillCreateDropdown } from "./SkillCreateDropdown";
import { useSkillsStore } from "../../stores/skills-store";

type Tab = "market" | "mine";

/** SKILL.md 模板 — 用户在"编写技能"modal 里基于此填写 */
// v1.0.15: 不再用 'TODO: ...' 假占位 — 空字段就空着,让 SKILL.md frontmatter
//          暴露"YAML key 存在但 value 空"的状态,比"假占位"更诚实。
const SKILL_TEMPLATE = (name: string, description: string, body: string): string => {
    const safeName = name.trim();
    const safeDesc = description.trim();
    return `---
name: ${safeName}
description: ${safeDesc}
---

# ${safeName}

## 何时使用

${safeDesc}

## 操作步骤

${body}
`;
};

export function SkillsPanel(): React.JSX.Element {
    const [tab, setTab] = useState<Tab>("market");
    const [githubDialog, setGithubDialog] = useState<{ open: boolean; url: string; result: string }>({
        open: false,
        url: "",
        result: "",
    });
    const [writeDialog, setWriteDialog] = useState<{
        open: boolean;
        name: string;
        description: string;
        body: string;
        copied: boolean;
    }>({ open: false, name: "", description: "", body: "", copied: false });
    const { marketQuery, setMarketQuery } = useSkillsStore();

    // 子组件(MySkills) 可通过自定义事件请求切 tab
    useEffect(() => {
        const onSetTab = (e: Event) => {
            const detail = (e as CustomEvent<"market" | "mine">).detail;
            if (detail === "market" || detail === "mine") {
                setTab(detail);
            }
        };
        window.addEventListener("skills-panel:set-tab", onSetTab);
        return () => window.removeEventListener("skills-panel:set-tab", onSetTab);
    }, []);

    // v1.0.14: "用 Pi 构建" — 切到 chat + ChatInput 预填一段 skill 草稿提示
    const handleBuildWithPi = (): void => {
        window.dispatchEvent(
            new CustomEvent("chatpanel:prefill", {
                detail: {
                    text:
                        "我想创建一个新的 Skill,请你帮我:\n" +
                        "1. 起一个简短的名字 (kebab-case,例如 web-search)\n" +
                        "2. 写一段 description 说明何时该用这个 skill\n" +
                        "3. 列出 3-5 步操作步骤(我会再润色)\n" +
                        "4. 用 YAML frontmatter 给我一份 SKILL.md 草稿\n\n",
                },
            }),
        );
    };

    // v1.0.17: "GitHub 导入" — 真 git clone + 检查 SKILL.md
    const handleImportFromGitHub = async (): Promise<void> => {
        const url = window.prompt("粘 GitHub 仓库 URL (e.g. https://github.com/user/repo):");
        if (!url) return;
        try {
            const result = await window.piAPI?.skillsGithubImport(url);
            if (result && typeof result === "object" && "success" in result) {
                const r = result as { success: boolean; path?: string; slug?: string; skillMdFound?: boolean };
                if (r.success) {
                    setGithubDialog({
                        open: true,
                        url,
                        result: `导入成功! ${r.skillMdFound ? "已检测到 SKILL.md" : "未检测到 SKILL.md (可能需要手动配置)"}\n路径: ${r.path ?? "unknown"}`,
                    });
                } else {
                    setGithubDialog({ open: true, url, result: `导入失败: ${String((result as { message?: string }).message ?? "未知错误")}` });
                }
            } else {
                setGithubDialog({ open: true, url, result: String(result ?? "无返回结果") });
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setGithubDialog({ open: true, url, result: `导入失败: ${msg}` });
        }
    };

    // v1.0.14: "编写技能" — 打开写 modal, 让用户填 name + description + body
    const handleWriteDirect = (): void => {
        setWriteDialog({ open: true, name: "", description: "", body: "", copied: false });
    };

    // v1.0.17: 写盘而非只复制到剪贴板
    const handleSaveSkillMd = async (): Promise<void> => {
        const text = SKILL_TEMPLATE(writeDialog.name, writeDialog.description, writeDialog.body);
        const safeName = writeDialog.name.trim().replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase();
        if (!safeName) {
            window.alert("请输入有效的技能名称 (只允许字母、数字、连字符和下划线)");
            return;
        }
        try {
            const result = await window.piAPI?.skillsWriteSkill(safeName, text);
            if (result && typeof result === "object" && "success" in result) {
                const r = result as { success: boolean; path?: string };
                if (r.success) {
                    setWriteDialog((d) => ({ ...d, copied: true }));
                    // 3 秒后自动关闭 modal
                    setTimeout(() => setWriteDialog({ open: false, name: "", description: "", body: "", copied: false }), 3000);
                } else {
                    window.alert(`保存失败: ${String((result as { message?: string }).message ?? "未知错误")}`);
                }
            }
        } catch (err) {
            // 回退到剪贴板复制
            try {
                await navigator.clipboard.writeText(text);
                setWriteDialog((d) => ({ ...d, copied: true }));
                setTimeout(() => setWriteDialog((d) => ({ ...d, copied: false })), 3000);
            } catch {
                window.alert(`保存失败,请手动复制:\n\n${err instanceof Error ? err.message : String(err)}`);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--mm-bg-sidebar)]" role="region" aria-label="技能面板">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e5e5e5]">
                <div className="flex items-center gap-1" role="tablist" aria-label="技能面板分类">
                    {([["market", "市场"], ["mine", "我的"]] as const).map(([id, label]) => {
                        const isActive = tab === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-controls={`skills-tabpanel-${id}`}
                                id={`skills-tab-${id}`}
                                onClick={() => setTab(id)}
                                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                                    isActive
                                        ? "bg-[#1a1a1a] text-white"
                                        : "text-[#666] hover:bg-[#f5f5f5]"
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
                <div className="flex-1" />
                {tab === "market" && (
                    <input
                        type="text"
                        placeholder="搜索技能..."
                        value={marketQuery}
                        onChange={(e) => setMarketQuery(e.target.value)}
                        aria-label="搜索技能"
                        className="pl-3 pr-3 py-1.5 bg-[#f5f5f5] border border-[#e5e5e5] rounded text-sm text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:border-[#1a1a1a] w-64"
                    />
                )}
                <SkillCreateDropdown
                    onBuildWithPi={handleBuildWithPi}
                    onWriteDirect={handleWriteDirect}
                    onImportFromGitHub={() => void handleImportFromGitHub()}
                />
            </div>

            <div
                className="flex-1 overflow-auto"
                role="tabpanel"
                id={`skills-tabpanel-${tab}`}
                aria-labelledby={`skills-tab-${tab}`}
            >
                {tab === "market" ? <SkillsMarketplace /> : <MySkills />}
            </div>

            {/* GitHub 导入结果 — 弹 modal 显示主进程返回 */}
            {githubDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div
                        className="bg-[var(--mm-bg-sidebar)] rounded-2xl p-6 max-w-md shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-label="从 GitHub 导入"
                    >
                        <h3 className="text-lg font-semibold mb-2 text-[var(--mm-text-primary)]">从 GitHub 导入</h3>
                        <p className="text-xs text-[var(--mm-text-tertiary)] mb-1">URL</p>
                        <p className="text-sm text-[var(--mm-text-primary)] mb-3 break-all font-mono">{githubDialog.url}</p>
                        <p className="text-sm text-[var(--mm-text-secondary)] mb-4">{githubDialog.result}</p>
                        <button
                            type="button"
                            onClick={() => setGithubDialog({ open: false, url: "", result: "" })}
                            className="px-4 py-2 bg-[var(--mm-bg-active)] text-[var(--mm-text-on-active)] rounded"
                            aria-label="关闭"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            )}

            {/* 编写技能 — 弹 modal 让用户填 SKILL.md 字段,复制到剪贴板 */}
            {writeDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div
                        className="bg-[var(--mm-bg-sidebar)] rounded-2xl p-6 max-w-2xl w-[90vw] max-h-[85vh] shadow-2xl flex flex-col"
                        role="dialog"
                        aria-modal="true"
                        aria-label="编写技能"
                    >
                        <h3 className="text-lg font-semibold mb-3 text-[var(--mm-text-primary)]">编写技能 (SKILL.md)</h3>
                        <p className="text-xs text-[var(--mm-text-tertiary)] mb-4">
                            填完后点"保存" — 写入 .agents/skills/ 目录下的 SKILL.md 文件。
                        </p>

                        <label className="block text-xs text-[var(--mm-text-secondary)] mb-1">名字 (kebab-case, e.g. web-search)</label>
                        <input
                            type="text"
                            value={writeDialog.name}
                            onChange={(e) => setWriteDialog((d) => ({ ...d, name: e.target.value }))}
                            placeholder="my-skill"
                            className="w-full mb-3 px-3 py-2 bg-[var(--color-hover)] border border-[var(--color-border)] rounded text-sm text-[var(--mm-text-primary)] placeholder:text-[var(--mm-text-tertiary)]"
                        />

                        <label className="block text-xs text-[var(--mm-text-secondary)] mb-1">何时使用 (description)</label>
                        <textarea
                            value={writeDialog.description}
                            onChange={(e) => setWriteDialog((d) => ({ ...d, description: e.target.value }))}
                            placeholder="一句话说明 Pi 何时该调这个 skill"
                            rows={2}
                            className="w-full mb-3 px-3 py-2 bg-[var(--color-hover)] border border-[var(--color-border)] rounded text-sm font-mono text-[var(--mm-text-primary)] placeholder:text-[var(--mm-text-tertiary)]"
                        />

                        <label className="block text-xs text-[var(--mm-text-secondary)] mb-1">操作步骤 (body)</label>
                        <textarea
                            value={writeDialog.body}
                            onChange={(e) => setWriteDialog((d) => ({ ...d, body: e.target.value }))}
                            placeholder="Pi 应该按什么步骤执行"
                            rows={6}
                            className="w-full flex-1 mb-4 px-3 py-2 bg-[var(--color-hover)] border border-[var(--color-border)] rounded text-sm font-mono text-[var(--mm-text-primary)] placeholder:text-[var(--mm-text-tertiary)]"
                        />

                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setWriteDialog({ open: false, name: "", description: "", body: "", copied: false })}
                                className="px-3 py-1.5 text-sm text-[var(--mm-text-secondary)] hover:bg-[var(--mm-bg-hover)] rounded"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleSaveSkillMd()}
                                className="px-4 py-1.5 bg-[var(--mm-bg-active)] text-[var(--mm-text-on-active)] text-sm rounded hover:bg-[#333]"
                            >
                                {writeDialog.copied ? "✓ 已保存" : "保存 SKILL.md"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

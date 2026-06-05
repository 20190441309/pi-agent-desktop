// ChatInput — 真接通 v1.0.13
// v1.0.12 之前: 4 个 clickable 中 3 个是死的 (附件/权限/模型 都没 onClick)
// v1.0.13:
//   - 附件按钮 → 调 window.piAPI.selectFiles() 拿 paths → 加到 attachments-store
//     → 上方渲染 chips 列表,每个有 X 删
//   - 权限下拉 → Popover + 3 档(只读/部分访问/完全访问) → settings.permissionLevel
//   - 模型下拉 → Popover + piModels 列表 → settings.model (+ provider)
// 发送按钮还是 ChatInput 自己的 onClick(handleSend/onStop),原本就真
// UI 一概不动,样式完全沿用之前

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useSettingsStore } from "../../stores/settings-store";
import { useAttachmentsStore } from "../../stores/attachments-store";
import { useI18n } from "../../i18n";
import { Popover } from "../common/Popover";

interface ChatInputProps {
  isConnected: boolean;
  isProcessing: boolean;
  onSend: (message: string) => Promise<void>;
  onStop: () => void;
  /** 当前 workspaceId — 用来把附件加到对应 workspace 的 attachments 列表 */
  workspaceId?: string;
  /** 外部注入的预填文本(welcome card 点击后写入, focus 后回调消费) */
  prefill?: string;
  /** prefill 的版本号,父级每次新触发 +1,保证同文本重复点击也能重跑 effect */
  prefillKey?: number;
  /** prefill 被写入 textarea 后回调,父级据此清空 prefill state */
  onPrefillConsumed?: () => void;
}

const PERMISSION_OPTIONS: Array<{ value: "read" | "partial" | "full"; label: string; desc: string }> = [
  { value: "read", label: "只读", desc: "只能读取文件" },
  { value: "partial", label: "部分访问", desc: "可编辑 workspace 内文件" },
  { value: "full", label: "完全访问", desc: "可执行任意命令" },
];

function basename(p: string): string {
  const m = p.match(/[^\\/]+$/);
  return m ? m[0] : p;
}

export function ChatInput({
  isConnected,
  isProcessing,
  onSend,
  onStop,
  workspaceId,
  prefill,
  prefillKey,
  onPrefillConsumed,
}: ChatInputProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { settings, updateSettings, piModels } = useSettingsStore();
  const { add: addAttachment, remove: removeAttachment, list: listAttachments } = useAttachmentsStore();
  const { t } = useI18n();

  // 附件 chips 按当前 workspace 隔离
  const attachments = workspaceId ? listAttachments(workspaceId) : [];

  // 自动调整 textarea 高度
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const maxHeight = 200;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  // 外部 prefill 进来:写入 textarea + focus + 回调让父级清空
  const onConsumedRef = useRef(onPrefillConsumed);
  onConsumedRef.current = onPrefillConsumed;
  useEffect(() => {
    if (typeof prefill === "string" && prefill.length > 0) {
      setInputValue(prefill);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        const ta = textareaRef.current;
        if (ta) {
          const len = ta.value.length;
          ta.setSelectionRange(len, len);
        }
      });
      onConsumedRef.current?.();
    }
  }, [prefill, prefillKey]);

  const handleSend = async (): Promise<void> => {
    if (!inputValue.trim() || isProcessing) return;
    await onSend(inputValue.trim());
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // ── 附件按钮真接通 ─────────────────────────────────────────────
  const handlePickFiles = useCallback(async (): Promise<void> => {
    if (!window.piAPI?.selectFiles) {
      // 没有 preload 暴露 — 兜底给用户提示
      window.alert("selectFiles 不可用 (preload 未注入)");
      return;
    }
    if (!workspaceId) {
      window.alert("请先选择 workspace");
      return;
    }
    const paths = await window.piAPI.selectFiles({ multiSelections: true });
    if (!Array.isArray(paths) || paths.length === 0) return;
    for (const p of paths) {
      addAttachment(workspaceId, {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: "file",
        name: basename(p),
        value: p,
      });
    }
  }, [workspaceId, addAttachment]);

  // ── 权限 / 模型下拉接通 ───────────────────────────────────────
  const currentPermission = settings.permissionLevel ?? "full";
  // v1.0.15: 不再 hardcode 'gpt-4' 兜底 — settings.model 由 loadPiConfig 真读 Pi CLI 配置
  const currentModel = settings.model;
  const handlePermissionSelect = useCallback(
    (value: "read" | "partial" | "full") => {
      updateSettings({ permissionLevel: value });
    },
    [updateSettings],
  );
  const handleModelSelect = useCallback(
    (model: { id: string; name: string; provider: string }) => {
      updateSettings({ model: model.id, provider: model.provider });
    },
    [updateSettings],
  );

  const canSend = inputValue.trim().length > 0 && isConnected;

  return (
    <div className="p-4 bg-white border-t border-[#e5e5e5]">
      <div className="max-w-3xl mx-auto">
        {/* 附件 chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2" role="list" aria-label="已选附件">
            {attachments.map((a) => (
              <span
                key={a.id}
                role="listitem"
                className="inline-flex items-center gap-1 px-2 py-1 bg-[#f5f5f5] border border-[#e5e5e5] rounded text-xs text-[#1a1a1a]"
                title={a.value}
              >
                <svg className="w-3 h-3 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="max-w-[200px] truncate">{a.name}</span>
                <button
                  type="button"
                  onClick={() => workspaceId && removeAttachment(workspaceId, a.id)}
                  className="ml-0.5 text-[#999] hover:text-[#1a1a1a] transition-colors"
                  aria-label={`移除附件 ${a.name}`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 输入框 + 发送按钮 */}
        <div className="flex gap-3 mb-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? t("chatInput.placeholder.ready") : t("chatInput.placeholder.noConnection")}
            className="flex-1 px-4 py-3 bg-[#f5f5f5] border border-[#e5e5e5] rounded-xl text-sm text-[#1a1a1a] placeholder:text-[#999] resize-none focus:outline-none focus:border-[#1a1a1a] disabled:opacity-50 min-h-[48px] leading-relaxed"
            rows={1}
            disabled={isProcessing || !isConnected}
            aria-label={t("chatInput.send")}
          />
          <button
            type="button"
            onClick={isProcessing ? onStop : () => void handleSend()}
            disabled={!isProcessing && !canSend}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 self-end ${
              isProcessing
                ? "bg-[#ef4444] hover:bg-[#dc2626] text-white"
                : "bg-[#1a1a1a] hover:bg-[#333] text-white disabled:opacity-30 disabled:cursor-not-allowed"
            }`}
            aria-label={isProcessing ? t("chatView.stopGeneration") : t("chatInput.send")}
            title={isProcessing ? t("chatView.stopGeneration") : t("chatInput.send")}
          >
            {isProcessing ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>

        {/* 控制栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handlePickFiles()}
              disabled={!workspaceId}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f5f5] border border-[#e5e5e5] rounded text-xs text-[#666] hover:bg-[#f0f0f0] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t("chatInput.addAttachment")}
              title={workspaceId ? t("chatInput.addAttachment") : "请先选择 workspace"}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t("chatInput.attachment")}
            </button>

            {/* 权限下拉 — 真接通 */}
            <Popover
              align="start"
              contentClassName="min-w-[200px]"
              trigger={
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f5f5] border border-[#e5e5e5] rounded text-xs text-[#666] cursor-pointer hover:bg-[#f0f0f0] transition-all"
                  role="button"
                  tabIndex={0}
                  aria-label={`权限: ${PERMISSION_OPTIONS.find((p) => p.value === currentPermission)?.label ?? "完全访问"}`}
                  data-testid="chat-input-permission-trigger"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>{PERMISSION_OPTIONS.find((p) => p.value === currentPermission)?.label ?? "完全访问"}</span>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              }
            >
              {(close) => (
                <div className="py-1">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#999]">权限档位</div>
                  {PERMISSION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={currentPermission === opt.value}
                      onClick={() => {
                        handlePermissionSelect(opt.value);
                        close();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-[#f5f5f5] flex items-start gap-2"
                    >
                      <span
                        className={`mt-0.5 inline-block w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                          currentPermission === opt.value
                            ? "border-[#1a1a1a] bg-[#1a1a1a]"
                            : "border-[#d4d4d4]"
                        }`}
                        aria-hidden
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-[#1a1a1a]">{opt.label}</span>
                        <span className="block text-xs text-[#999]">{opt.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Popover>
          </div>

          <div className="flex items-center gap-3">
            {/* 快捷键提示 */}
            <div className="flex items-center gap-1.5 text-xs text-[#999]" aria-hidden="true">
              <kbd className="px-1.5 py-0.5 bg-[#f5f5f5] border border-[#e5e5e5] rounded text-[10px] font-mono">Enter</kbd>
              <span>{t("chatInput.shortcuts.send")}</span>
              <span className="mx-1 text-[#e5e5e5]">/</span>
              <kbd className="px-1.5 py-0.5 bg-[#f5f5f5] border border-[#e5e5e5] rounded text-[10px] font-mono">Shift</kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 bg-[#f5f5f5] border border-[#e5e5e5] rounded text-[10px] font-mono">Enter</kbd>
              <span>{t("chatInput.shortcuts.newline")}</span>
            </div>

            {/* 模型下拉 — 真接通 */}
            <Popover
              align="end"
              contentClassName="min-w-[220px]"
              trigger={
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f5f5] border border-[#e5e5e5] rounded text-xs text-[#666] cursor-pointer hover:bg-[#f0f0f0] transition-all"
                  role="button"
                  tabIndex={0}
                  aria-label={currentModel ? `当前模型: ${currentModel}` : "未选择模型"}
                  data-testid="chat-input-model-trigger"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {/* v1.0.15: 空态显示"未选择",不显示假 gpt-4 */}
                  <span>{currentModel || "未选择"}</span>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              }
            >
              {(close) => (
                <div className="py-1">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#999]">选择模型</div>
                  {piModels && piModels.length > 0 ? (
                    piModels.map((m) => (
                      <button
                        key={`${m.provider}:${m.id}`}
                        type="button"
                        role="menuitemradio"
                        aria-checked={settings.model === m.id}
                        onClick={() => {
                          handleModelSelect({ id: m.id, name: m.name, provider: m.provider });
                          close();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-[#f5f5f5] flex items-start gap-2"
                      >
                        <span
                          className={`mt-0.5 inline-block w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                            settings.model === m.id ? "border-[#1a1a1a] bg-[#1a1a1a]" : "border-[#d4d4d4]"
                          }`}
                          aria-hidden
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-[#1a1a1a]">{m.name}</span>
                          <span className="block text-xs text-[#999]">{m.providerName}</span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-xs text-[#999]">
                      暂无可用模型 (Pi CLI 未配置)
                    </div>
                  )}
                </div>
              )}
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
}

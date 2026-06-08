import React, { useEffect, useRef, useState } from "react";
import type { PiPackageInfo } from "@shared";
import { usePiPackagesStore } from "../../stores/pi-packages-store";

const RECOMMENDED = ["pi-git", "pi-web-access", "pi-mcp-adapter", "pi-subagents", "context-mode"];

interface SourceTrustInfo {
  protocol: string;
  target: string;
  risk: string;
}

function scoreRecommended(pkg: PiPackageInfo): number {
  const text = `${pkg.name} ${pkg.description}`.toLowerCase();
  const index = RECOMMENDED.findIndex((needle) => text.includes(needle));
  return index === -1 ? 999 : index;
}

function describePackageSource(source: string): SourceTrustInfo {
  const trimmed = source.trim();
  const match = trimmed.match(/^([a-zA-Z][\w-]*):(.*)$/);
  const protocol = match?.[1]?.toLowerCase() ?? "npm";
  const target = match ? match[2] : trimmed;
  const risk = {
    npm: "从 npm 包源安装，请确认包名和维护者可信。",
    git: "从 Git 仓库安装，请确认仓库地址、分支和维护者可信。",
    http: "通过 HTTP 下载，传输未加密，建议只在可信网络中使用。",
    https: "通过 HTTPS 下载，请确认域名和仓库来源可信。",
    ssh: "通过 SSH 拉取仓库，可能使用本机 SSH 凭据。",
    file: "从本地路径安装，请确认该目录内容可信。",
  }[protocol] ?? "未知来源类型，请确认来源可信后再安装。";
  return { protocol, target: target || trimmed, risk };
}

export function PiPackagesMarketplace(): React.JSX.Element {
  const {
    query,
    results,
    installed,
    loading,
    actionSource,
    error,
    retryAction,
    lastFailedAction,
    lastAction,
    search,
    refreshCatalog,
    refreshInstalled,
    install,
    remove,
  } = usePiPackagesStore();
  const [pendingInstall, setPendingInstall] = useState<PiPackageInfo | null>(null);
  const lastSearchedQueryRef = useRef(query);
  const pendingTrust = pendingInstall ? describePackageSource(pendingInstall.source) : null;

  useEffect(() => {
    void refreshInstalled();
    void search();
  }, [refreshInstalled, search]);

  useEffect(() => {
    if (lastSearchedQueryRef.current === query) return;
    const id = setTimeout(() => {
      lastSearchedQueryRef.current = query;
      void search();
    }, 300);
    return () => clearTimeout(id);
  }, [query, search]);

  const installedSources = new Set(installed.map((item) => item.source));
  const visible = results
    .slice()
    .sort((a, b) => scoreRecommended(a) - scoreRecommended(b));

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0 text-xs text-[#777]">
          Pi 插件目录
        </div>
        <button
          type="button"
          onClick={() => void refreshCatalog()}
          disabled={loading || Boolean(actionSource)}
          className="rounded-md border border-[#e5e5e5] px-2 py-1 text-xs text-[#666] hover:bg-[#f5f5f5] disabled:opacity-50"
        >
          {loading ? "刷新中..." : "刷新目录"}
        </button>
      </div>
      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          <span className="min-w-0 flex-1 break-words">
            {lastFailedAction ? (
              <>
                {lastFailedAction.label}
                {lastFailedAction.source ? (
                  <>
                    {" "}
                    <span className="font-mono">{lastFailedAction.source}</span>
                    {" "}失败：{error}
                  </>
                ) : (
                  <>失败：{error}</>
                )}
              </>
            ) : error}
          </span>
          {retryAction && (
            <button
              type="button"
              onClick={() => void retryAction()}
              disabled={Boolean(actionSource) || loading}
              className="shrink-0 rounded-md bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-800 disabled:opacity-50"
            >
              {lastFailedAction ? `重试${lastFailedAction.label}` : "重试"}
            </button>
          )}
        </div>
      )}
      {lastAction && (
        <div className="mb-4 rounded-lg border border-[#dbe8d0] bg-[#f5fbf0] px-3 py-2 text-sm text-[#315f24]" role="status">
          {lastAction.message}{lastAction.requiresRestart ? "。新 Pi 会话或重启当前会话后生效。" : ""}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-[#999]" role="status">加载 Pi 插件市场...</div>
      ) : visible.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#999]" role="status">
          {query ? "没有找到匹配的 Pi 插件" : "Pi 插件市场暂时不可用，可打开 pi.dev/packages 查看"}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((pkg) => {
            const installedNow = pkg.installed || installedSources.has(pkg.source);
            const busy = actionSource === pkg.source;
            return (
              <article key={pkg.source} className="flex min-h-[168px] flex-col rounded-lg border border-[#e5e5e5] bg-white p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="min-w-0 truncate text-sm font-medium text-[#1a1a1a]" title={pkg.name}>{pkg.name}</h3>
                  <span className="shrink-0 rounded bg-[#f5f5f5] px-1.5 py-0.5 text-[10px] text-[#777]">Pi</span>
                </div>
                <p className="line-clamp-3 flex-1 text-xs leading-5 text-[#666]">{pkg.description || "暂无描述"}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(pkg.url, "_blank")}
                    className="rounded px-2 py-1 text-xs text-[#666] hover:bg-[#f5f5f5]"
                  >
                    详情
                  </button>
                  <div className="flex-1" />
                  {installedNow ? (
                    <button
                      type="button"
                      aria-label={`卸载 ${pkg.name}`}
                      disabled={busy}
                      onClick={() => void remove(pkg.source)}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {busy ? "处理中..." : "卸载"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={`安装 ${pkg.name}`}
                      disabled={busy}
                      onClick={() => setPendingInstall(pkg)}
                      className="rounded bg-[#1a1a1a] px-2 py-1 text-xs text-white hover:bg-[#333] disabled:opacity-50"
                    >
                      {busy ? "安装中..." : "安装"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pendingInstall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[440px] rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="确认安装 Pi 插件">
            <h3 className="text-base font-semibold text-[#1a1a1a]">安装 Pi 插件</h3>
            <p className="mt-2 text-sm leading-6 text-[#666]">
              将全局安装 <span className="font-mono text-[#1a1a1a]">{pendingInstall.source}</span>。插件可能提供 extension、skill、prompt template 或 theme，并影响 Pi agent 的行为。
            </p>
            {pendingTrust && (
              <dl className="mt-3 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg border border-[#eeeeea] bg-[#fbfbfa] px-3 py-3 text-xs">
                <dt className="text-[#999]">协议</dt>
                <dd className="m-0 font-mono text-[#333]">{pendingTrust.protocol}</dd>
                <dt className="text-[#999]">目标</dt>
                <dd className="m-0 min-w-0 truncate font-mono text-[#333]" title={pendingTrust.target}>{pendingTrust.target}</dd>
                <dt className="text-[#999]">信任提示</dt>
                <dd className="m-0 leading-5 text-[#7c2d12]">{pendingTrust.risk}</dd>
              </dl>
            )}
            <p className="mt-2 text-xs leading-5 text-[#999]">安装后需要新 Pi 会话或重启当前会话才会生效。</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingInstall(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-[#666] hover:bg-[#f5f5f5]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const source = pendingInstall.source;
                  setPendingInstall(null);
                  void install(source);
                }}
                className="rounded-lg bg-[#1a1a1a] px-3 py-1.5 text-sm text-white hover:bg-[#333]"
              >
                确认安装
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

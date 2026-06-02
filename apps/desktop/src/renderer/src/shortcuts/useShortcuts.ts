// useShortcuts (M7+ 可用度-C)
// 在 App 顶层挂一个全局 keydown 监听 (模块级 refcount, 多次挂载也只一个),
// 组件 unmount 时自动反注册 handler.
//
// 所有走法都委托到 registry 的 dispatchShortcut(), 避免重复匹配逻辑.

import { useEffect, useRef } from "react";
import { findMatchingShortcut } from "./registry";

/**
 * 安装全局快捷键监听, 把命中的 shortcut 转给 handlers[id]
 *
 * @param handlers  id → 回调 映射. 只关心自己用到的快捷键即可,
 *                  没注册 handler 的 shortcut 不会被触发.
 *
 * 多次挂载也只会保留一个真实 keydown listener (StrictMode / HMR 安全).
 * 因为 listener 是模块级单例, handlers 通过 module-scope 变量更新,
 * 重挂 / 切换组件也总是能拿到最新的 handlers.
 */
export function useShortcuts(handlers: Record<string, () => void>): void {
    // handlers 每次 render 都是新对象, 用 ref 存最新值
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    useEffect(() => {
        setCurrentHandlersGetter(() => handlersRef.current);
        refCount++;
        ensureListenerAttached();

        return () => {
            refCount--;
            // 不真的 detach (模块级单例, 避免闭包陷阱),
            // 只清空 getter, 后续 keydown 不会触发任何 handler
            if (refCount <= 0) {
                setCurrentHandlersGetter(null);
            }
        };
    }, []);
}

// ---- 共享全局 listener (模块级单例) --------------------------------------

type HandlersGetter = () => Record<string, () => void>;

let refCount = 0;
let attached = false;
let currentGetter: HandlersGetter | null = null;

function setCurrentHandlersGetter(g: HandlersGetter | null): void {
    currentGetter = g;
}

function ensureListenerAttached(): void {
    if (attached) return;
    window.addEventListener("keydown", onSharedKeydown, true);
    attached = true;
}

function onSharedKeydown(e: KeyboardEvent): void {
    if (!currentGetter) return;
    const matched = findMatchingShortcut(e);
    if (!matched) return;
    const fn = currentGetter()[matched.id];
    if (!fn) return;
    e.preventDefault();
    fn();
}

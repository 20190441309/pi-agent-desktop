// useCommandPalette (M2 Task M2-5, refactored in 可用度-C)
// 命令面板 state hook.
//
// 设计变更 (v1.0.3, 可用度-C):
// - 移除 inline keydown listener. 原因: M7 之前这里和 App.tsx (line 53-67) 各自
//   挂一个 Ctrl+K 监听, 同一次按键会触发两次 toggle (palette 闪一下, 行为诡异).
// - 改成纯 state hook. Ctrl+K 派发由 App 顶层 useShortcuts 统一安装的全局 listener 完成
//   (见 shortcuts/registry.ts), App 拿自己的 paletteOpen state 控制 CommandPalette 显隐.
// - 调用方式不变: const { isOpen, setIsOpen, close } = useCommandPalette()
//
// 历史背景:
//   M2 时期该 hook 假定自己就是 Ctrl+K 的唯一 owner, App 也在监听,
//   实际上 React StrictMode 下 keydown listener 会被注册两次 (effect 跑两遍)
//   加上 App 那个 inline handler 就是四次, 详见 CHANGELOG 1.0.3.

import { useState } from "react";

export function useCommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    return { isOpen, setIsOpen, close: () => setIsOpen(false) };
}

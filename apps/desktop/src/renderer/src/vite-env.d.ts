// v1.0.10 (L2): __APP_VERSION__ 在 vite.config.ts 里 define 注入, 从 package.json 读.
// 不要在这里写默认值 — 编译时若 define 漏了, 应该立刻报 undefined, 不会静默用错版本.

declare const __APP_VERSION__: string;

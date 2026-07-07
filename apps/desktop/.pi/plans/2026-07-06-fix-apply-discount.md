---
title: "修复 applyDiscount 让 npm test 通过"
status: draft
created: "2026-07-06T15:56:41.591Z"
type: fix
---

## 目标
修复 `src/discount.js` 中的 `applyDiscount` 实现，使 `npm test` 通过；当前处于只读计划模式，不修改源码、不运行测试。

## 现有证据
- 当前工作目录：`C:/Ai/pi-desktop/apps/desktop`
- 已用只读检索确认：
  - `find . **/discount.js`：未找到 `discount.js`
  - `grep .. applyDiscount`：未找到 `applyDiscount`
  - 当前包 `package.json` 存在 `test` 脚本：`vitest --run`
  - 当前 `src/` 仅包含 `main/`、`preload/`、`renderer/`、`test/`
- 风险：用户提到的 `src/discount.js` 可能位于另一项目根目录，或当前工作目录不是目标项目。

## 需要触碰的文件
- 预期：`src/discount.js`
- 可能需要读取但不一定修改：
  - `package.json`
  - 与折扣逻辑相关的测试文件，例如 `src/discount.test.js`、`test/discount.test.js`、`__tests__/discount.test.js`

## 步骤序列

### 1. 读取文件与定位测试
1. 在正确项目根目录执行只读定位：
   - 查找 `src/discount.js`
   - 查找包含 `applyDiscount` 的测试或源码
   - 读取 `package.json`，确认 `npm test` 实际命令
2. 读取：
   - `src/discount.js`
   - 相关测试文件
3. 从测试断言反推 `applyDiscount` 合同：
   - 参数形状
   - 折扣类型，例如百分比、固定金额、无折扣
   - 边界条件，例如负数、超过 100%、空值、价格不能小于 0
   - 返回值格式，例如 number、对象、四舍五入规则

### 2. 修改实现
1. 仅修改 `src/discount.js`。
2. 按测试合同实现 `applyDiscount`：
   - 保持导出方式不变，例如 CommonJS `module.exports` 或 ESM `export`
   - 保持函数签名不变
   - 添加最小必要输入保护
   - 确保最终价格不为负数
   - 如测试要求，按既有规则处理精度与舍入
3. 避免修改测试来适配实现，除非发现测试本身明显错误且用户确认。

### 3. 运行测试
1. 运行目标测试优先：
   - 若可定位单测：`npm test -- discount`
   - 否则运行：`npm test`
2. 若失败：
   - 读取失败输出
   - 对照断言修正 `src/discount.js`
   - 重跑相关测试
3. 完成前保存验证证据：
   - 命令
   - 退出码
   - 关键通过输出

## 验证检查点
- 检查点 1：已确认目标仓库内存在 `src/discount.js` 与相关测试。
- 检查点 2：已明确 `applyDiscount` 期望行为，且实现只改 `src/discount.js`。
- 检查点 3：`npm test` 通过；如只运行局部测试，还需最终运行完整 `npm test`。

## 风险
- 当前目录未找到 `src/discount.js` 或 `applyDiscount`，可能需要切换到正确项目目录。
- 测试命令可能不是当前 Electron 项目的 `vitest --run`，需以目标项目 `package.json` 为准。
- 折扣精度规则若未在测试中覆盖，需沿用现有代码风格，避免引入额外行为变化。

## 需要用户选择
A) 提供正确项目路径，我在该路径重新做只读勘察并更新计划。  
B) 如果 `src/discount.js` 应在当前目录但缺失，确认是否要后续执行阶段新建该文件。  
C) 退出计划模式后按本计划实施：读取目标文件 → 修改 `applyDiscount` → 运行 `npm test`。
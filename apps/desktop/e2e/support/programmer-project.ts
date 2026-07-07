import { execFileSync } from "child_process";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export const IMPLEMENTED_CART_SOURCE = `const BULK_DISCOUNT_THRESHOLD = 5;
const BULK_DISCOUNT_RATE = 0.9;

function lineTotal(line) {
  const base = line.quantity * line.unitPrice;
  return line.quantity >= BULK_DISCOUNT_THRESHOLD ? base * BULK_DISCOUNT_RATE : base;
}

export function calculateCartTotal(lines) {
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  return Number(total.toFixed(2));
}
`;

export type MiniNodeProject = {
    readonly workspacePath: string;
    readonly cartSourcePath: string;
    readonly resultPath: string;
};

type MiniProjectResult = {
    readonly passed: boolean;
    readonly total: number;
};

export function prepareMiniNodeProject(workspacePath: string): MiniNodeProject {
    mkdirSync(join(workspacePath, "src"), { recursive: true });
    mkdirSync(join(workspacePath, "tests"), { recursive: true });
    writeFileSync(join(workspacePath, "package.json"), JSON.stringify({
        name: "programmer-mini-cart",
        version: "1.0.0",
        type: "module",
        scripts: { test: "node tests/cart.test.mjs" },
    }, null, 2));
    writeFileSync(join(workspacePath, ".gitignore"), ".e2e-test-result.json\n");
    writeFileSync(join(workspacePath, "src", "cart.js"), "export function calculateCartTotal(_lines) {\n  return 0;\n}\n");
    writeFileSync(join(workspacePath, "tests", "cart.test.mjs"), `import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { calculateCartTotal } from "../src/cart.js";

const total = calculateCartTotal([
  { sku: "book", quantity: 2, unitPrice: 12.5 },
  { sku: "keyboard", quantity: 6, unitPrice: 10 },
]);

assert.equal(total, 79);
writeFileSync(".e2e-test-result.json", JSON.stringify({ passed: true, total }, null, 2));
console.log("ALL TESTS PASSED: cart total = " + total);
`);
    execFileSync("git", ["init"], { cwd: workspacePath, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "e2e@example.test"], { cwd: workspacePath, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Programmer E2E"], { cwd: workspacePath, stdio: "ignore" });
    execFileSync("git", ["add", "."], { cwd: workspacePath, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "Initial broken cart implementation"], { cwd: workspacePath, stdio: "ignore" });
    return {
        workspacePath,
        cartSourcePath: join(workspacePath, "src", "cart.js"),
        resultPath: join(workspacePath, ".e2e-test-result.json"),
    };
}

export function readMiniProjectResult(resultPath: string): MiniProjectResult {
    return JSON.parse(readFileSync(resultPath, "utf-8")) as MiniProjectResult;
}

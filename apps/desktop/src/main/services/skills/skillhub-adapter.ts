import {
    searchSkills as builtinSearch,
    listInstalled as builtinListInstalled,
    installSkill as builtinInstall,
    uninstallSkill as builtinUninstall,
    checkSkillhubApi,
    parseSearchOutput as builtinParseSearchOutput,
    type SkillInfo,
    type InstalledSkill,
} from "./builtin-skillhub";
import { execFile } from "child_process";

export type { SkillInfo, InstalledSkill };

function skillhubEnv(): NodeJS.ProcessEnv {
    return {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        LC_ALL: process.platform === "win32" ? process.env.LC_ALL : "C.UTF-8",
    };
}

export { builtinParseSearchOutput as parseSearchOutput };

async function isCliAvailable(): Promise<boolean> {
    try {
        await new Promise<void>((resolve, reject) => {
            execFile("skillhub", ["--version"], { timeout: 5000, env: skillhubEnv() }, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        return true;
    } catch {
        return false;
    }
}

let useCli: boolean | null = null;

async function shouldUseCli(): Promise<boolean> {
    if (useCli !== null) return useCli;
    useCli = await isCliAvailable();
    return useCli;
}

export async function searchSkills(query: string, limit = 20): Promise<SkillInfo[]> {
    if (await shouldUseCli()) {
        return new Promise((resolve, reject) => {
            execFile("skillhub", ["search", query, "--json", "--search-limit", String(limit)], {
                timeout: 30_000,
                env: skillhubEnv(),
                windowsHide: true,
            }, (err, stdout) => {
                if (err) reject(new Error(`skillhub search failed: ${err.message}`));
                else resolve(builtinParseSearchOutput(String(stdout ?? "")));
            });
        });
    }
    return builtinSearch(query, limit);
}

export async function listInstalled(workspacePath?: string): Promise<string[]> {
    if (await shouldUseCli()) {
        return new Promise((resolve, reject) => {
            execFile("skillhub", ["list"], {
                timeout: 10_000,
                env: skillhubEnv(),
                windowsHide: true,
            }, (err, stdout) => {
                if (err) reject(new Error(`skillhub list failed: ${err.message}`));
                else {
                    const trimmed = String(stdout ?? "").trim();
                    resolve(!trimmed || trimmed.startsWith("No installed") ? [] : trimmed.split("\n").map((s) => s.trim()).filter(Boolean));
                }
            });
        });
    }
    return builtinListInstalled(workspacePath ?? process.cwd());
}

export async function installSkill(slug: string, cwd: string = process.cwd()): Promise<void> {
    if (await shouldUseCli()) {
        return new Promise((resolve, reject) => {
            execFile("skillhub", ["install", slug, "--dir", "skills"], {
                timeout: 60_000,
                cwd,
                env: skillhubEnv(),
                windowsHide: true,
            }, (err) => {
                if (err) reject(new Error(`skillhub install failed for "${slug}": ${err.message}`));
                else resolve();
            });
        });
    }
    return builtinInstall(slug, cwd);
}

export async function uninstallSkill(slug: string, cwd: string = process.cwd()): Promise<void> {
    return builtinUninstall(slug, cwd);
}

export async function checkSkillhubInstalled(): Promise<boolean> {
    if (await shouldUseCli()) return true;
    return checkSkillhubApi();
}

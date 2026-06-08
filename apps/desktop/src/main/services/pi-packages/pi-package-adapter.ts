import { execFile } from "child_process";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { InstalledPiPackage, PiPackageActionResult, PiPackageInfo } from "@shared";

const CATALOG_URL = "https://pi.dev/packages";
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

let catalogCache: { fetchedAt: number; packages: PiPackageInfo[] } | null = null;

function windowsNpmBinPath(): string {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "npm");
}

function piEnv(): NodeJS.ProcessEnv {
    const envPath = process.env.PATH ?? process.env.Path ?? "";
    const windowsNpmBin = windowsNpmBinPath();
    return {
        ...process.env,
        PATH:
            process.platform === "win32" && !envPath.toLowerCase().split(";").includes(windowsNpmBin.toLowerCase())
                ? `${windowsNpmBin};${envPath}`
                : envPath,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        LC_ALL: process.platform === "win32" ? process.env.LC_ALL : "C.UTF-8",
    };
}

function quoteCmdArg(value: string): string {
    return `"${value.replace(/(["^&|<>])/g, "^$1")}"`;
}

function resolvePiInvocation(args: string[]): { command: string; args: string[]; windowsVerbatimArguments?: boolean } {
    if (process.platform !== "win32") return { command: "pi", args };

    const npmBin = windowsNpmBinPath();
    const cliJs = join(npmBin, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "cli.js");
    if (existsSync(cliJs)) {
        return { command: "node", args: [cliJs, ...args] };
    }

    const npmShim = join(npmBin, "pi.cmd");
    const command = existsSync(npmShim) ? npmShim : "pi.cmd";
    return {
        command: process.env.ComSpec ?? "cmd.exe",
        args: ["/d", "/c", [command, ...args].map(quoteCmdArg).join(" ")],
        windowsVerbatimArguments: true,
    };
}

function execPi(args: string[], timeout = 60_000): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const env = piEnv();
        const invocation = resolvePiInvocation(args);
        execFile(invocation.command, invocation.args, {
            env,
            timeout,
            windowsHide: true,
            windowsVerbatimArguments: invocation.windowsVerbatimArguments,
        }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`${error.message}${stderr ? `\n${stderr}` : ""}`));
                return;
            }
            resolve({ stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
        });
    });
}

function decodeHtml(value: string): string {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'");
}

function stripTags(value: string): string {
    return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function parsePackageCatalog(html: string): PiPackageInfo[] {
    const byName = new Map<string, PiPackageInfo>();
    const cardPattern =
        /<a href="\/packages\/([^"]+)"[^>]*data-package-link="true"[^>]*>([\s\S]*?)<\/a>/g;
    for (const match of html.matchAll(cardPattern)) {
        const path = decodeHtml(match[1]);
        const body = match[2];
        const title = body.match(/<strong>([\s\S]*?)<\/strong>/)?.[1];
        const description = body.match(/<span>([\s\S]*?)<\/span>/)?.[1] ?? "";
        const name = stripTags(title ?? path);
        if (!name) continue;
        byName.set(name, {
            name,
            source: `npm:${name}`,
            description: stripTags(description),
            url: `${CATALOG_URL}/${path}`,
            installed: false,
        });
    }
    return [...byName.values()];
}

export function clearPackageCatalogCacheForTest(): void {
    catalogCache = null;
}

export function parsePiList(stdout: string): InstalledPiPackage[] {
    if (!stdout.trim() || /no packages installed/i.test(stdout)) return [];
    const sources = new Set<string>();
    for (const match of stdout.matchAll(/(?:npm|git|https?|ssh|file):[^\s,]+/g)) {
        sources.add(match[0].replace(/[.)\]]+$/, ""));
    }
    if (sources.size === 0) {
        for (const line of stdout.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || /^packages?:?$/i.test(trimmed)) continue;
            if (/installed/i.test(trimmed) && !trimmed.includes(":")) continue;
            sources.add(trimmed.split(/\s+/)[0]);
        }
    }
    return [...sources].map((source) => ({
        source,
        name: source.replace(/^npm:/, ""),
        enabled: true,
        scope: "global" as const,
    }));
}

function readConfiguredPackageSources(): string[] {
    const settingsPath = join(homedir(), ".pi", "agent", "settings.json");
    if (!existsSync(settingsPath)) return [];
    try {
        const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as Record<string, unknown>;
        const found = new Set<string>();
        const visit = (value: unknown): void => {
            if (typeof value === "string" && /^(npm|git|https?|ssh|file):/.test(value)) {
                found.add(value);
                return;
            }
            if (Array.isArray(value)) value.forEach(visit);
            if (value && typeof value === "object") Object.values(value).forEach(visit);
        };
        visit(settings);
        return [...found];
    } catch {
        return [];
    }
}

export async function fetchPackageCatalog(): Promise<PiPackageInfo[]> {
    if (catalogCache && Date.now() - catalogCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
        return catalogCache.packages;
    }
    const res = await fetch(CATALOG_URL);
    if (!res.ok) {
        throw new Error(`pi.dev package catalog returned HTTP ${res.status}`);
    }
    const packages = parsePackageCatalog(await res.text());
    catalogCache = { fetchedAt: Date.now(), packages };
    return packages;
}

export async function listInstalledPackages(): Promise<InstalledPiPackage[]> {
    const listed = parsePiList((await execPi(["list"], 30_000)).stdout);
    const bySource = new Map(listed.map((item) => [item.source, item]));
    for (const source of readConfiguredPackageSources()) {
        if (!bySource.has(source)) {
            bySource.set(source, {
                source,
                name: source.replace(/^npm:/, ""),
                enabled: true,
                scope: "global",
            });
        }
    }
    return [...bySource.values()];
}

export async function searchPackages(query: string): Promise<PiPackageInfo[]> {
    const installed = new Set((await listInstalledPackages()).map((item) => item.source));
    const packages = await fetchPackageCatalog();
    const q = query.trim().toLowerCase();
    return packages
        .map((pkg) => ({ ...pkg, installed: installed.has(pkg.source) }))
        .filter((pkg) => {
            if (!q) return true;
            return `${pkg.name} ${pkg.description} ${pkg.source}`.toLowerCase().includes(q);
        })
        .slice(0, 80);
}

export async function installPackage(source: string): Promise<PiPackageActionResult> {
    const normalized = source.includes(":") ? source : `npm:${source}`;
    await execPi(["install", normalized], 120_000);
    return {
        success: true,
        message: `已安装 ${normalized}`,
        requiresRestart: true,
    };
}

export async function removePackage(source: string): Promise<PiPackageActionResult> {
    await execPi(["remove", source], 60_000);
    return {
        success: true,
        message: `已卸载 ${source}`,
        requiresRestart: true,
    };
}

export async function updatePackage(source: string): Promise<PiPackageActionResult> {
    await execPi(["update", source], 120_000);
    return {
        success: true,
        message: `已更新 ${source}`,
        requiresRestart: true,
    };
}

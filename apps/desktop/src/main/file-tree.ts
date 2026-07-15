import { readdir, stat } from "fs/promises";
import { extname, basename, join } from "path";
import { getProtectedPathReason } from "./services/protected-paths";

export interface FileTreeNode {
    name: string;
    path: string;
    type: "file" | "directory";
    children?: FileTreeNode[];
    extension?: string;
    size?: number;
    truncated?: boolean;
}

const DEFAULT_IGNORES = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    "out",
    ".cache",
    ".next",
    ".turbo",
    "coverage",
]);

export interface FileTreeOptions {
    maxDepth?: number;
    maxEntries?: number;
}

function sortNodes(a: FileTreeNode, b: FileTreeNode): number {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function fileNode(targetPath: string, size: number): FileTreeNode {
    const name = basename(targetPath) || targetPath;
    return {
        name,
        path: targetPath,
        type: "file",
        extension: extname(name).replace(/^\./, ""),
        size,
    };
}

function clampMaxEntries(maxEntries: number | undefined): number {
    return Math.max(50, Math.min(maxEntries ?? 1200, 5000));
}

export async function listDirectory(
    targetPath: string,
    options: Pick<FileTreeOptions, "maxEntries"> = {},
): Promise<FileTreeNode> {
    const targetStats = await stat(targetPath);
    if (!targetStats.isDirectory()) return fileNode(targetPath, targetStats.size);

    const maxEntries = clampMaxEntries(options.maxEntries);
    const entries = await readdir(targetPath, { withFileTypes: true });
    const children: FileTreeNode[] = [];
    let truncated = false;

    for (const entry of entries) {
        if (DEFAULT_IGNORES.has(entry.name)) continue;
        if (children.length >= maxEntries) {
            truncated = true;
            break;
        }

        const childPath = join(targetPath, entry.name);
        if (getProtectedPathReason(childPath, targetPath)) continue;
        if (entry.isDirectory()) {
            children.push({
                name: entry.name,
                path: childPath,
                type: "directory",
            });
            continue;
        }
        if (!entry.isFile()) continue;

        try {
            const childStats = await stat(childPath);
            children.push(fileNode(childPath, childStats.size));
        } catch {
            children.push({
                name: entry.name,
                path: childPath,
                type: "file",
                extension: extname(entry.name).replace(/^\./, ""),
                truncated: true,
            });
        }
    }

    return {
        name: basename(targetPath) || targetPath,
        path: targetPath,
        type: "directory",
        children: children.sort(sortNodes),
        ...(truncated ? { truncated: true } : {}),
    };
}

export async function buildFileTree(
    workspacePath: string,
    maxDepthOrOptions: number | FileTreeOptions = 4,
): Promise<FileTreeNode> {
    const options = typeof maxDepthOrOptions === "number"
        ? { maxDepth: maxDepthOrOptions }
        : maxDepthOrOptions;
    const maxDepth = Math.max(1, Math.min(options.maxDepth ?? 4, 8));
    const maxEntries = clampMaxEntries(options.maxEntries);
    let visited = 0;

    const walk = async (targetPath: string, depth: number): Promise<FileTreeNode> => {
        const targetStats = await stat(targetPath);
        if (!targetStats.isDirectory()) return fileNode(targetPath, targetStats.size);

        const node: FileTreeNode = {
            name: basename(targetPath) || targetPath,
            path: targetPath,
            type: "directory",
            children: [],
        };

        if (depth >= maxDepth || visited >= maxEntries) {
            node.truncated = true;
            return node;
        }

        const children: FileTreeNode[] = [];
        for (const entry of await readdir(targetPath, { withFileTypes: true })) {
            if (DEFAULT_IGNORES.has(entry.name)) continue;
            if (visited >= maxEntries) {
                node.truncated = true;
                break;
            }
            visited += 1;
            const childPath = join(targetPath, entry.name);
            if (getProtectedPathReason(childPath, workspacePath)) continue;
            try {
                if (entry.isDirectory() || entry.isFile()) {
                    children.push(await walk(childPath, depth + 1));
                }
            } catch {
                children.push({
                    name: entry.name,
                    path: childPath,
                    type: entry.isDirectory() ? "directory" : "file",
                    truncated: true,
                });
            }
        }

        node.children = children.sort(sortNodes);
        return node;
    };

    return walk(workspacePath, 0);
}

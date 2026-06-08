import { normalize, resolve, sep } from "path";
import { homedir } from "os";

const SENSITIVE_FILE_PATTERNS = [
    /^\.env(?:\..*)?$/i,
    /^\.npmrc$/i,
    /^\.netrc$/i,
    /^\.pypirc$/i,
    /^id_(?:rsa|dsa|ecdsa|ed25519)$/i,
    /^known_hosts$/i,
    /^config$/i,
    /^credentials(?:\..*)?$/i,
    /^credentials\.json$/i,
    /^secrets?(?:[._-].*)?$/i,
    /^.*(?:token|secret|credential)s?\.(?:json|ya?ml|toml|txt|env)$/i,
];

const SENSITIVE_DIR_NAMES = new Set([
    ".ssh",
    ".gnupg",
    ".aws",
    ".azure",
    ".kube",
    ".docker",
]);

function withTrailingSeparator(path: string): string {
    return path.endsWith(sep) ? path : `${path}${sep}`;
}

export function isPathInside(parent: string, child: string): boolean {
    const root = withTrailingSeparator(resolve(parent));
    const target = resolve(child);
    return target === resolve(parent) || withTrailingSeparator(target).startsWith(root);
}

export function getProtectedPathReason(targetPath: string, workspacePath?: string): string | null {
    const resolved = resolve(targetPath);
    if (workspacePath && !isPathInside(workspacePath, resolved)) {
        return "路径不在当前工作区内";
    }

    const home = normalize(homedir());
    if (resolved === home) return "用户 Home 根目录需要额外确认";

    const parts = resolved.split(/[\\/]/).filter(Boolean);
    const lowerParts = parts.map((part) => part.toLowerCase());
    const name = parts.at(-1) ?? "";
    if (
        lowerParts.some((part) => SENSITIVE_DIR_NAMES.has(part)) ||
        lowerParts.some((part, index) => part === ".config" && lowerParts[index + 1] === "gcloud")
    ) {
        return "路径位于敏感凭据目录";
    }
    if (SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(name))) {
        return "敏感配置或凭据文件暂不允许直接读取";
    }
    return null;
}

import { existsSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";

export type PiSdkModule = typeof import("@earendil-works/pi-coding-agent");

let sdkPromise: Promise<PiSdkModule> | null = null;

export function resolvePiSdkEntry(baseDir = __dirname): string | undefined {
    const candidates = [
        join(baseDir, "../../../../node_modules/@earendil-works/pi-coding-agent/dist/index.js"),
        join(baseDir, "../../../node_modules/@earendil-works/pi-coding-agent/dist/index.js"),
        join(baseDir, "../../node_modules/@earendil-works/pi-coding-agent/dist/index.js"),
    ];
    return candidates.find((candidate) => existsSync(candidate));
}

export async function loadPiSdk(baseDir = __dirname): Promise<PiSdkModule> {
    if (!sdkPromise) {
        const entry = resolvePiSdkEntry(baseDir);
        if (!entry) {
            throw new Error("Pi SDK runtime entry not found under node_modules.");
        }
        sdkPromise = import(pathToFileURL(entry).href) as Promise<PiSdkModule>;
    }
    return sdkPromise;
}

export function resetPiSdkForTests(): void {
    sdkPromise = null;
}

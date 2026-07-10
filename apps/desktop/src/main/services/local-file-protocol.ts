import { protocol, net } from 'electron';
import { pathToFileURL } from 'url';
import log from 'electron-log/main';
import { getProtectedPathReason, isPathInside } from './protected-paths';

/**
 * Register the `localfile://` custom protocol used by the renderer to load
 * workspace files into <img> / <webview> / fetch() without a file:// URL.
 *
 * audit round 3, Task 3: the protocol now takes a `getCurrentWorkspacePath`
 * dependency and refuses any request that isn't inside the active workspace.
 * Previously it only blocked sensitive-file patterns (.env, .ssh, …), so a
 * renderer compromised via XSS could read arbitrary local files
 * (e.g. `localfile:///c:/Users/secret/config.json`) as long as the name didn't
 * match a sensitive pattern. The workspace-boundary check closes that hole.
 */
export function registerLocalFileProtocol(opts: {
    getCurrentWorkspacePath: () => string | null;
}): void {
    const { getCurrentWorkspacePath } = opts;
    protocol.handle('localfile', (request) => {
        const filePath = decodeURIComponent(request.url.replace('localfile://', ''));

        // No active workspace → refuse. The protocol is only meaningful when a
        // workspace is selected; without one there is no legitimate localfile
        // request the renderer could make.
        const workspacePath = getCurrentWorkspacePath();
        if (!workspacePath) {
            log.warn('[localfile] rejected: no active workspace');
            return new Response('Forbidden: no active workspace', { status: 403 });
        }

        // Hard workspace boundary: even if the file isn't a sensitive pattern,
        // it must live inside the active workspace. This is the core fix —
        // without it, any file on disk was reachable.
        if (!isPathInside(workspacePath, filePath)) {
            log.warn(`[localfile] rejected: path outside workspace (${filePath} not inside ${workspacePath})`);
            return new Response('Forbidden: path outside workspace', { status: 403 });
        }

        // Defense in depth: still block sensitive files (e.g. .env inside the
        // workspace) via the existing protected-paths policy.
        const reason = getProtectedPathReason(filePath, workspacePath);
        if (reason) {
            log.warn(`[localfile] rejected: ${reason} (${filePath})`);
            // statusText must be a ByteString (ASCII); put the localized reason
            // in the body instead so the workspace boundary / protected-path
            // rationale stays observable without breaking the Response ctor.
            return new Response(`Forbidden: ${reason}`, { status: 403 });
        }

        try {
            return net.fetch(pathToFileURL(filePath).href);
        } catch (err) {
            log.warn(`[localfile] Failed to serve: ${filePath}`, err);
            return new Response('File not found', { status: 404 });
        }
    });
    log.info('[localfile] Protocol registered: localfile://');
}

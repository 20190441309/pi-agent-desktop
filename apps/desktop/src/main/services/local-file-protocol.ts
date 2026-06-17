import { protocol, net } from 'electron';
import { pathToFileURL } from 'url';
import log from 'electron-log/main';

export function registerLocalFileProtocol(): void {
    protocol.handle('localfile', (request) => {
        const filePath = decodeURIComponent(request.url.replace('localfile://', ''));
        try {
            return net.fetch(pathToFileURL(filePath).href);
        } catch (err) {
            log.warn(`[localfile] Failed to serve: ${filePath}`, err);
            return new Response('File not found', { status: 404 });
        }
    });
    log.info('[localfile] Protocol registered: localfile://');
}
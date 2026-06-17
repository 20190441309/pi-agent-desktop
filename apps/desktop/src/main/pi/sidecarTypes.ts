// Pi Sidecar Host — Design document for v2.0 architecture
// 
// ARCHITECTURE: Move Pi SDK from main process to Electron utilityProcess
//
// Current (v1.x):
//   Main process → Pi SDK (AgentSession) directly in-process
//   - Pi SDK memory impacts main process responsiveness
//   - Pi SDK crash can take down the whole app
//
// Target (v2.0):
//   Main process ← typed JSON messages ← Sidecar process (utilityProcess)
//   - Sidecar runs Pi SDK in isolated process
//   - Main process stays lean (~100MB)
//   - Sidecar can crash/restart independently
//   - Communication via process.parentPort.postMessage() / MessageChannel
//
// This file defines the message protocol between main and sidecar.
// The actual sidecar entry point will be at src/main/pi/sidecar.ts
// The host that manages the sidecar will be at src/main/pi/sidecarHost.ts

export type SidecarCommand =
    | { type: 'start_session'; workspaceId: string; workspacePath: string }
    | { type: 'prompt'; workspaceId: string; text: string }
    | { type: 'steer'; workspaceId: string; text: string }
    | { type: 'abort'; workspaceId: string }
    | { type: 'stop'; workspaceId: string }
    | { type: 'get_models'; workspaceId: string }
    | { type: 'get_providers'; workspaceId: string }
    | { type: 'set_model'; workspaceId: string; provider: string; model: string }
    | { type: 'shutdown' };

export type SidecarEvent =
    | { type: 'session_ready'; workspaceId: string }
    | { type: 'session_event'; workspaceId: string; event: unknown }
    | { type: 'session_error'; workspaceId: string; error: string }
    | { type: 'output_append'; workspaceId: string; text: string }
    | { type: 'models_result'; workspaceId: string; models: unknown[] }
    | { type: 'providers_result'; workspaceId: string; providers: unknown[] }
    | { type: 'stopped'; workspaceId: string }
    | { type: 'error'; error: string };

export interface SidecarHost {
    start(): Promise<void>;
    stop(): Promise<void>;
    restart(): Promise<void>;
    sendCommand(command: SidecarCommand): void;
    onEvent(handler: (event: SidecarEvent) => void): () => void;
    isRunning(): boolean;
}

// Implementation notes:
// 1. Electron utilityProcess runs in a separate Node.js process
// 2. Communication uses process.parentPort.postMessage() (structured clone)
// 3. The sidecar entry point must be a separate JS file bundled by electron-vite
// 4. electron-vite config needs a new entry for the sidecar in main.rollupOptions.input
// 5. Main process creates the sidecar via: utilityProcess.fork(pathToSidecar)
// 6. All Pi SDK imports move from main process to sidecar process
// 7. The current pi-driver.ts, pi-session/*, agent-runtime/* stay in main as coordination layer
// 8. Approval/permission flow: sidecar → main (via message) → renderer (via IPC) → main → sidecar
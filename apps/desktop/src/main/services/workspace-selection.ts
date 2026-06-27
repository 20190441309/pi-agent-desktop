export interface WorkspaceSelectionRecord {
    id: string;
    name: string;
    path: string;
    createdAt: number;
    lastActiveAt?: number;
}

export function getMostRecentlyActiveWorkspace<T extends WorkspaceSelectionRecord>(
    workspaces: readonly T[],
): T | undefined {
    return workspaces.reduce<T | undefined>((current, candidate) => {
        if (!current) return candidate;
        const currentTimestamp = current.lastActiveAt ?? current.createdAt;
        const candidateTimestamp = candidate.lastActiveAt ?? candidate.createdAt;
        return candidateTimestamp > currentTimestamp ? candidate : current;
    }, undefined);
}

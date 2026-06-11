// PendingEdits
// Tracks file_edit tool changes, shows diff to user after execution
// Used by ApprovalPanel's EditReviewList
// Supports autoApprove flag (interceptor skips approval dialog when set)

export interface TrackedEdit {
    id: string;
    toolCallId: string;
    toolName: "write" | "edit";
    filePath: string;
    newContent?: string;
    oldString?: string;
    newString?: string;
    diff?: string;
    timestamp: number;
}

export class PendingEdits {
    private map = new Map<string, TrackedEdit>();
    /** v1.1: 自动审批开关 (renderer 同步过来) */
    private _autoApprove = false;

    get autoApprove(): boolean {
        return this._autoApprove;
    }

    set autoApprove(value: boolean) {
        this._autoApprove = value;
    }

    track(
        toolCallId: string,
        toolName: "write" | "edit",
        filePath: string,
        args: { content?: string; old_string?: string; new_string?: string }
    ): string {
        const id = `change_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.map.set(id, {
            id,
            toolCallId,
            toolName,
            filePath,
            newContent: args.content,
            oldString: args.old_string,
            newString: args.new_string,
            timestamp: Date.now(),
        });
        return id;
    }

    review(id: string, diff: string, finalContent: string): void {
        const change = this.map.get(id);
        if (change) {
            change.diff = diff;
            change.newContent = finalContent;
        }
    }

    approve(id: string): void {
        this.map.delete(id);
    }

    reject(id: string): void {
        this.map.delete(id);
    }

    remove(id: string): void {
        this.map.delete(id);
    }

    get(id: string): TrackedEdit | undefined {
        return this.map.get(id);
    }

    list(): TrackedEdit[] {
        return [...this.map.values()].sort((a, b) => b.timestamp - a.timestamp);
    }

    clear(): void {
        this.map.clear();
    }

    size(): number {
        return this.map.size;
    }
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function normalizeLegacyToolCall(value: unknown): unknown {
    const record = asRecord(value);
    if (!record) return value;
    return {
        ...record,
        id: record.toolCallId ?? record.id,
        name: record.toolName ?? record.name,
        input: record.input ?? record.args,
        output: record.output ?? record.result,
    };
}

export function normalizeLegacyMessagePayload(raw: unknown): unknown {
    const record = asRecord(raw);
    if (!record || !Array.isArray(record.toolCalls)) return raw;
    return {
        ...record,
        toolCalls: record.toolCalls.map((toolCall) => normalizeLegacyToolCall(toolCall)),
    };
}

import type {
    CustomMessageCard,
    CustomMessageCardAction,
    CustomMessageCardKind,
    GeneratedUiAction,
    GeneratedUiCardV1,
    GeneratedUiKeyValueItem,
    GeneratedUiListItem,
    GeneratedUiSection,
} from "@shared";

const LEGACY_CARD_KINDS = new Set<CustomMessageCardKind>([
    "status-list",
    "approval-actions",
    "task-progress",
    "result-summary",
    "file-actions",
]);

const GENERATED_UI_ACTION_KINDS = new Set<GeneratedUiAction["kind"]>([
    "slash-command",
    "open-file",
    "copy-text",
    "switch-view",
    "refresh",
]);

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function fallbackId(prefix: string, index: number): string {
    return `${prefix}_${index}`;
}

function basename(path: string): string {
    return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function normalizeSectionKind(kind: string): GeneratedUiSection["kind"] | null {
    const normalized = kind.trim().toLowerCase().replace(/[\s-]+/g, "_");
    switch (normalized) {
        case "summary":
            return "summary";
        case "status_list":
        case "status":
        case "statuslist":
            return "status_list";
        case "steps":
        case "step_list":
        case "progress":
        case "task_progress":
            return "steps";
        case "key_value":
        case "keyvalue":
        case "facts":
            return "key_value";
        case "file_list":
        case "filelist":
        case "files":
            return "file_list";
        case "action_bar":
        case "actions":
            return "action_bar";
        case "markdown":
            return "markdown";
        default:
            return null;
    }
}

function sanitizeAction(raw: unknown, index: number): GeneratedUiAction | null {
    const data = asRecord(raw);
    const kind = typeof data.kind === "string" ? data.kind : "";
    if (!GENERATED_UI_ACTION_KINDS.has(kind as GeneratedUiAction["kind"])) return null;
    const value = typeof data.value === "string" ? data.value : "";
    if (!value) return null;
    return {
        id: typeof data.id === "string" ? data.id : fallbackId("action", index),
        label: typeof data.label === "string" ? data.label : kind,
        kind: kind as GeneratedUiAction["kind"],
        value,
    };
}

function sanitizeListItem(raw: unknown, index: number): GeneratedUiListItem | null {
    const data = asRecord(raw);
    const path = typeof data.path === "string" ? data.path : undefined;
    const label = typeof data.label === "string"
        ? data.label
        : typeof data.name === "string"
            ? data.name
            : path
                ? basename(path)
                : "";
    if (!label && !path) return null;
    return {
        id: typeof data.id === "string" ? data.id : fallbackId("item", index),
        label: label || path || `Item ${index + 1}`,
        status: typeof data.status === "string" ? data.status : undefined,
        description: typeof data.description === "string" ? data.description : undefined,
        path,
    };
}

function sanitizeKeyValueItem(raw: unknown, index: number): GeneratedUiKeyValueItem | null {
    const data = asRecord(raw);
    const key = typeof data.key === "string"
        ? data.key
        : typeof data.label === "string"
            ? data.label
            : "";
    const value = typeof data.value === "string"
        ? data.value
        : typeof data.text === "string"
            ? data.text
            : "";
    if (!key || !value) return null;
    return {
        id: typeof data.id === "string" ? data.id : fallbackId("kv", index),
        key,
        value,
    };
}

function sanitizeGeneratedSection(raw: unknown, index: number): GeneratedUiSection | null {
    const data = asRecord(raw);
    const kind = typeof data.kind === "string" ? normalizeSectionKind(data.kind) : null;
    if (!kind) return null;
    const id = typeof data.id === "string" ? data.id : fallbackId("section", index);

    if (kind === "summary" || kind === "markdown") {
        const content = typeof data.content === "string" ? data.content.trim() : "";
        return content ? { id, kind, content } : null;
    }

    if (kind === "action_bar") {
        const actions = Array.isArray(data.actions)
            ? data.actions
                .map((action, actionIndex) => sanitizeAction(action, actionIndex))
                .filter((action): action is GeneratedUiAction => action !== null)
            : [];
        return actions.length > 0 ? { id, kind, actions } : null;
    }

    if (kind === "key_value") {
        const items = Array.isArray(data.items)
            ? data.items
                .map((item, itemIndex) => sanitizeKeyValueItem(item, itemIndex))
                .filter((item): item is GeneratedUiKeyValueItem => item !== null)
            : [];
        return items.length > 0 ? { id, kind, items } : null;
    }

    const items = Array.isArray(data.items)
        ? data.items
            .map((item, itemIndex) => sanitizeListItem(item, itemIndex))
            .filter((item): item is GeneratedUiListItem => item !== null)
        : [];
    return items.length > 0 ? { id, kind, items } : null;
}

function sanitizeLegacyCustomCard(raw: unknown): CustomMessageCard {
    const data = asRecord(raw);
    const requestedKind = typeof data.kind === "string" ? data.kind : typeof data.customType === "string" ? data.customType : "";
    const kind: CustomMessageCard["kind"] = LEGACY_CARD_KINDS.has(requestedKind as CustomMessageCardKind)
        ? requestedKind as CustomMessageCardKind
        : "markdown-fallback";
    const actions = Array.isArray(data.actions)
        ? data.actions.flatMap((action, index): CustomMessageCardAction[] => {
            const next = sanitizeAction(action, index);
            return next ? [{
                id: next.id,
                label: next.label,
                kind: next.kind,
                value: next.value,
            }] : [];
        })
        : undefined;
    const items = Array.isArray(data.items)
        ? data.items.flatMap((item, index) => {
            const next = sanitizeListItem(item, index);
            return next ? [next] : [];
        })
        : undefined;

    return {
        id: typeof data.id === "string" ? data.id : `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        kind,
        title: typeof data.title === "string" ? data.title : undefined,
        content: typeof data.content === "string" ? data.content : undefined,
        items,
        actions,
    };
}

export function legacyCustomMessageCardToGeneratedUi(card: CustomMessageCard): GeneratedUiCardV1 {
    const sections: GeneratedUiSection[] = [];

    if (card.content?.trim()) {
        sections.push({
            id: `${card.id}_markdown`,
            kind: card.kind === "result-summary" ? "summary" : "markdown",
            content: card.content.trim(),
        });
    }

    if (card.items?.length) {
        const sectionKind: Extract<GeneratedUiSection["kind"], "status_list" | "steps" | "file_list"> =
            card.kind === "task-progress"
                ? "steps"
                : card.kind === "file-actions"
                    ? "file_list"
                    : "status_list";
        sections.push({
            id: `${card.id}_items`,
            kind: sectionKind,
            items: card.items.map((item) => ({ ...item })),
        });
    }

    if (card.actions?.length) {
        sections.push({
            id: `${card.id}_actions`,
            kind: "action_bar",
            actions: card.actions.map((action) => ({ ...action })),
        });
    }

    return {
        version: "v1",
        id: card.id,
        title: card.title,
        sections,
    };
}

export function normalizeGeneratedUi(raw: unknown): GeneratedUiCardV1 | null {
    const data = asRecord(raw);

    if (Array.isArray(data.sections)) {
        const sections = data.sections
            .map((section, index) => sanitizeGeneratedSection(section, index))
            .filter((section): section is GeneratedUiSection => section !== null);
        const fallbackContent = typeof data.content === "string" ? data.content.trim() : "";
        if (sections.length === 0 && fallbackContent) {
            sections.push({
                id: "markdown_fallback",
                kind: "markdown",
                content: fallbackContent,
            });
        }
        if (sections.length > 0 || typeof data.title === "string") {
            return {
                version: "v1",
                id: typeof data.id === "string" ? data.id : `generated_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                title: typeof data.title === "string" ? data.title : undefined,
                sections,
            };
        }
    }

    const hasLegacySignals =
        typeof data.kind === "string" ||
        typeof data.customType === "string" ||
        Array.isArray(data.items) ||
        Array.isArray(data.actions) ||
        typeof data.content === "string" ||
        typeof data.title === "string";

    if (!hasLegacySignals) return null;

    const legacy = legacyCustomMessageCardToGeneratedUi(sanitizeLegacyCustomCard(raw));
    return legacy.sections.length > 0 || legacy.title ? legacy : null;
}

export function cloneGeneratedUiCard(card: GeneratedUiCardV1 | undefined): GeneratedUiCardV1 | undefined {
    if (!card) return undefined;
    return {
        ...card,
        sections: card.sections.map((section) => {
            if (section.kind === "key_value") {
                return {
                    ...section,
                    items: section.items.map((item) => ({ ...item })),
                };
            }
            if (section.kind === "status_list" || section.kind === "steps" || section.kind === "file_list") {
                return {
                    ...section,
                    items: section.items.map((item) => ({ ...item })),
                };
            }
            if ("actions" in section) {
                return {
                    ...section,
                    actions: section.actions.map((action) => ({ ...action })),
                };
            }
            return { ...section };
        }),
    };
}

function pushPlainTextLine(lines: string[], value: string | undefined): void {
    const next = value?.trim();
    if (next) lines.push(next);
}

function generatedUiListItemLine(item: GeneratedUiListItem): string {
    const parts = [item.label.trim()];
    const status = item.status?.trim();
    const description = item.description?.trim();
    const path = item.path?.trim();
    if (status) parts.push(`(${status})`);
    if (description) parts.push(description);
    if (path && path !== item.label.trim()) parts.push(path);
    return parts.join(" - ");
}

export function generatedUiToPlainText(card: GeneratedUiCardV1 | undefined): string {
    if (!card) return "";
    const lines: string[] = [];
    pushPlainTextLine(lines, card.title);
    for (const section of card.sections) {
        switch (section.kind) {
            case "summary":
            case "markdown":
                pushPlainTextLine(lines, section.content);
                break;
            case "status_list":
            case "steps":
            case "file_list":
                for (const item of section.items) {
                    pushPlainTextLine(lines, generatedUiListItemLine(item));
                }
                break;
            case "key_value":
                for (const item of section.items) {
                    pushPlainTextLine(lines, `${item.key}: ${item.value}`);
                }
                break;
            case "action_bar":
                for (const action of section.actions) {
                    pushPlainTextLine(lines, `操作: ${action.label} -> ${action.value}`);
                }
                break;
            default: {
                const unreachable: never = section;
                return unreachable;
            }
        }
    }
    return lines.join("\n").trim();
}

export function contentWithGeneratedUiText(content: string, card: GeneratedUiCardV1 | undefined): string {
    const plainCardText = generatedUiToPlainText(card);
    const plainContent = content.trim();
    if (!plainContent) return plainCardText;
    if (!plainCardText) return content;
    return plainContent === plainCardText ? plainContent : `${plainContent}\n${plainCardText}`;
}

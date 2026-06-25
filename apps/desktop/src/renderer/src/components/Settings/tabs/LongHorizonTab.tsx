import React from "react";
import { mergeLongHorizonSettings, type AgentMode, type LongHorizonSettings, type LongHorizonToggle } from "@shared";
import { useI18n } from "../../../i18n";
import { useSettingsStore } from "../../../stores/settings-store";
import { FieldRow, SectionTitle, SwitchControl } from "../_shared";

type ToggleKey = {
    [K in keyof LongHorizonSettings]: LongHorizonSettings[K] extends LongHorizonToggle ? K : never;
}[keyof LongHorizonSettings];

function clampInt(value: string, fallback: number, min: number, max: number): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

export function LongHorizonTab(): React.JSX.Element {
    const { t } = useI18n();
    const { settings, updateSettings } = useSettingsStore();
    const longHorizon = mergeLongHorizonSettings(settings.longHorizon);

    const updateLongHorizon = (updates: Partial<LongHorizonSettings>): void => {
        updateSettings({
            longHorizon: mergeLongHorizonSettings({
                ...longHorizon,
                ...updates,
            }),
        });
    };

    const updateToggle = (key: ToggleKey): void => {
        const current = longHorizon[key];
        updateLongHorizon({ [key]: { ...current, enabled: !current.enabled } } as Partial<LongHorizonSettings>);
    };

    return (
        <div className="settings-tab-panel" role="tabpanel" id="settings-tabpanel-longHorizon" aria-labelledby="settings-tab-longHorizon">
            <SectionTitle title={t("settings.longHorizon.heading")} description={t("settings.longHorizon.description")} />
            <div className="rounded-xl border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] px-4">
                <FieldRow label={t("settings.longHorizon.enabled.label")} description={t("settings.longHorizon.enabled.description")}>
                    <SwitchControl
                        checked={longHorizon.enabled}
                        label={t("settings.longHorizon.enabled.label")}
                        onChange={() => updateLongHorizon({ enabled: !longHorizon.enabled })}
                    />
                </FieldRow>
                <FieldRow label={t("settings.longHorizon.defaultMode.label")} description={t("settings.longHorizon.defaultMode.description")}>
                    <select
                        value={longHorizon.defaultMode}
                        onChange={(event) => updateLongHorizon({ defaultMode: event.target.value as AgentMode })}
                        className="w-full rounded-lg border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] px-3 py-2.5 text-sm text-[var(--mm-text-primary)] focus:border-[var(--mm-accent-blue)] focus:outline-none"
                        aria-label={t("settings.longHorizon.defaultMode.label")}
                        disabled={!longHorizon.enabled}
                    >
                        <option value="build">Build</option>
                        <option value="plan">Plan</option>
                        <option value="compose">Compose</option>
                        {longHorizon.maxMode.enabled && <option value="max">Max</option>}
                    </select>
                </FieldRow>
            </div>

            <SectionTitle title={t("settings.longHorizon.modes.heading")} description={t("settings.longHorizon.modes.description")} />
            <div className="rounded-xl border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] px-4">
                {(["planMode", "composeMode"] as const).map((key) => (
                    <FieldRow
                        key={key}
                        label={t(`settings.longHorizon.${key}.label`)}
                        description={t(`settings.longHorizon.${key}.description`)}
                    >
                        <SwitchControl
                            checked={longHorizon[key].enabled}
                            label={t(`settings.longHorizon.${key}.label`)}
                            onChange={() => updateToggle(key)}
                        />
                    </FieldRow>
                ))}
                <FieldRow label={t("settings.longHorizon.maxMode.label")} description={t("settings.longHorizon.maxMode.description")}>
                    <div className="flex items-center gap-3">
                        <SwitchControl
                            checked={longHorizon.maxMode.enabled}
                            label={t("settings.longHorizon.maxMode.label")}
                            onChange={() => updateLongHorizon({ maxMode: { ...longHorizon.maxMode, enabled: !longHorizon.maxMode.enabled } })}
                        />
                        <label className="flex items-center gap-2 text-xs text-[var(--mm-text-secondary)]">
                            <span>{t("settings.longHorizon.maxMode.candidates")}</span>
                            <input
                                type="number"
                                min={1}
                                max={20}
                                value={longHorizon.maxMode.candidates ?? 5}
                                onChange={(event) => updateLongHorizon({
                                    maxMode: {
                                        ...longHorizon.maxMode,
                                        candidates: clampInt(event.target.value, 5, 1, 20),
                                    },
                                })}
                                className="w-16 rounded-md border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] px-2 py-1 text-xs"
                                aria-label={t("settings.longHorizon.maxMode.candidates")}
                            />
                        </label>
                    </div>
                </FieldRow>
            </div>

            <SectionTitle title={t("settings.longHorizon.systems.heading")} description={t("settings.longHorizon.systems.description")} />
            <div className="rounded-xl border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] px-4">
                {(["goal", "memory", "history", "checkpoint", "task", "actor", "subagents"] as const).map((key) => (
                    <FieldRow
                        key={key}
                        label={t(`settings.longHorizon.${key}.label`)}
                        description={t(`settings.longHorizon.${key}.description`)}
                    >
                        <SwitchControl
                            checked={longHorizon[key].enabled}
                            label={t(`settings.longHorizon.${key}.label`)}
                            onChange={() => updateToggle(key)}
                        />
                    </FieldRow>
                ))}
                <FieldRow label={t("settings.longHorizon.ccIndex.label")} description={t("settings.longHorizon.ccIndex.description")}>
                    <SwitchControl
                        checked={longHorizon.memory.ccIndex ?? false}
                        label={t("settings.longHorizon.ccIndex.label")}
                        onChange={() => updateLongHorizon({
                            memory: {
                                ...longHorizon.memory,
                                ccIndex: !(longHorizon.memory.ccIndex ?? false),
                            },
                        })}
                    />
                </FieldRow>
                <FieldRow label={t("settings.longHorizon.workflow.label")} description={t("settings.longHorizon.workflow.description")}>
                    <div className="flex flex-wrap items-center gap-3">
                        <SwitchControl
                            checked={longHorizon.workflow.enabled}
                            label={t("settings.longHorizon.workflow.label")}
                            onChange={() => {
                                const enabled = !longHorizon.workflow.enabled;
                                updateLongHorizon({
                                    workflow: { ...longHorizon.workflow, enabled },
                                    composeWorkflow: { enabled },
                                });
                            }}
                        />
                        <label className="flex items-center gap-2 text-xs text-[var(--mm-text-secondary)]">
                            <span>{t("settings.longHorizon.workflow.maxConcurrentAgents")}</span>
                            <input
                                type="number"
                                min={1}
                                max={64}
                                value={longHorizon.workflow.maxConcurrentAgents ?? 4}
                                onChange={(event) => updateLongHorizon({
                                    workflow: {
                                        ...longHorizon.workflow,
                                        maxConcurrentAgents: clampInt(event.target.value, 4, 1, 64),
                                    },
                                })}
                                className="w-16 rounded-md border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] px-2 py-1 text-xs"
                                aria-label={t("settings.longHorizon.workflow.maxConcurrentAgents")}
                            />
                        </label>
                    </div>
                </FieldRow>
            </div>

            <SectionTitle title={t("settings.longHorizon.background.heading")} description={t("settings.longHorizon.background.description")} />
            <div className="rounded-xl border border-[var(--mm-border)] bg-[var(--mm-bg-panel)] px-4">
                {(["dream", "distill"] as const).map((key) => (
                    <FieldRow
                        key={key}
                        label={t(`settings.longHorizon.${key}.label`)}
                        description={t(`settings.longHorizon.${key}.description`)}
                    >
                        <SwitchControl
                            checked={longHorizon[key].enabled}
                            label={t(`settings.longHorizon.${key}.label`)}
                            onChange={() => updateToggle(key)}
                        />
                    </FieldRow>
                ))}
            </div>
        </div>
    );
}

// Pi Agent tab — Pi 状态 + 完整配置展示. 自行加载 piFullConfig.

import React, { useEffect, useState } from 'react';
import { PiStatusPanel } from '../../PiStatusPanel';
import { useI18n } from '../../../i18n';
import { SectionTitle, SettingsCard, SettingsPage } from '../_shared';

export function PiAgentTab(): React.JSX.Element {
    const { t } = useI18n();
    const [piFullConfig, setPiFullConfig] = useState<Awaited<ReturnType<typeof window.piAPI.getFullConfig>> | null>(null);

    useEffect(() => {
        if (!window.piAPI?.getFullConfig) return;
        let active = true;

        const loadConfig = (): void => {
            window.piAPI.getFullConfig().then((config) => {
                if (active) setPiFullConfig(config);
            }).catch(console.error);
        };

        loadConfig();
        window.addEventListener('focus', loadConfig);
        const unsubscribe = window.piAPI.onPiConfigChanged?.(() => {
            loadConfig();
        });
        return () => {
            active = false;
            window.removeEventListener('focus', loadConfig);
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, []);

    return (
        <SettingsPage tabId="piagent" title={t('settings.piagent.heading')} description={t('settings.piagent.description')}>
            <div data-settings-anchor="piagent-status">
                <SectionTitle title={t('settings.piagent.statusHeading')} description={t('settings.piagent.statusDescription')} />
                <PiStatusPanel />
            </div>

            {piFullConfig ? (
                <>
                    <SettingsCard anchorId="piagent-defaults" className="px-5 py-4">
                        <SectionTitle title={t('settings.piagent.defaultsHeading')} description={t('settings.piagent.defaultsDescription')} />
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-[var(--mm-border)] bg-[var(--mm-bg-main)] p-4">
                                <div className="text-xs text-[var(--mm-text-tertiary)]">{t('settings.piagent.defaultProvider')}</div>
                                <div className="mt-2 text-sm font-medium text-[var(--mm-text-primary)]">{piFullConfig.defaultProvider || t('settings.piagent.notSet')}</div>
                            </div>
                            <div className="rounded-xl border border-[var(--mm-border)] bg-[var(--mm-bg-main)] p-4">
                                <div className="text-xs text-[var(--mm-text-tertiary)]">{t('settings.piagent.defaultModel')}</div>
                                <div className="mt-2 text-sm font-medium text-[var(--mm-text-primary)]">{piFullConfig.defaultModel || t('settings.piagent.notSet')}</div>
                            </div>
                        </div>
                    </SettingsCard>

                    <SettingsCard anchorId="piagent-providers" className="px-5 py-4">
                        <SectionTitle title={t('settings.piagent.providersHeading')} description={t('settings.piagent.providersDescription')} />
                        <div className="grid gap-2">
                            {piFullConfig.providers.map((provider) => (
                                <div key={provider.id} className="rounded-xl border border-[var(--mm-border)] bg-[var(--mm-bg-main)] p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="truncate text-sm font-medium text-[var(--mm-text-primary)]">{provider.name}</span>
                                        <span className="shrink-0 text-xs text-[var(--mm-text-tertiary)]">{t('settings.piagent.modelCount', { count: provider.modelCount })}</span>
                                    </div>
                                    {provider.baseUrl && <div className="mt-2 truncate font-mono text-xs text-[var(--mm-text-tertiary)]">{provider.baseUrl}</div>}
                                </div>
                            ))}
                        </div>
                    </SettingsCard>

                    <SettingsCard anchorId="piagent-config-path" className="px-5 py-4">
                        <SectionTitle title={t('settings.piagent.configPath')} description={t('settings.piagent.configPathDescription')} />
                        <div className="rounded-xl border border-[var(--mm-border)] bg-[var(--mm-bg-main)] p-4 font-mono text-xs text-[var(--mm-text-secondary)] break-all">
                            {piFullConfig.configPath}
                        </div>
                    </SettingsCard>
                </>
            ) : (
                <SettingsCard className="px-5 py-4">
                    <div className="rounded-xl border border-dashed border-[var(--mm-border)] bg-[var(--mm-bg-panel)] p-4 text-sm text-[var(--mm-text-tertiary)]">
                        {t('settings.piagent.loading')}
                    </div>
                </SettingsCard>
            )}
        </SettingsPage>
    );
}

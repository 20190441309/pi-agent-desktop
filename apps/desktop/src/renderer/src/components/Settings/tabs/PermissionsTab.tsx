import React from 'react';
import { ToolPermissionsPanel } from '../../ToolPermissions/ToolPermissionsPanel';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useI18n } from '../../../i18n';
import { SettingsCard, SettingsPage, SectionTitle } from '../_shared';

export function PermissionsTab(): React.JSX.Element {
    const { t } = useI18n();
    const currentWorkspace = useWorkspaceStore((state) => state.getCurrentWorkspace());

    return (
        <SettingsPage tabId="permissions" title={t('settings.permissions.heading')} description={t('settings.permissions.description')}>
            <SettingsCard anchorId="permissions-workspace" className="px-5 py-4">
                <SectionTitle title={t('settings.permissions.workspaceHeading')} description={t('settings.permissions.workspaceDescription')} />
                <div className="rounded-xl border border-[var(--mm-border)] bg-[var(--mm-bg-main)] px-4 py-3">
                    <div className="text-xs text-[var(--mm-text-tertiary)]">{t('settings.permissions.workspaceLabel')}</div>
                    <div className="mt-1 truncate text-sm font-medium text-[var(--mm-text-primary)]" title={currentWorkspace?.path}>
                        {currentWorkspace ? `${currentWorkspace.name} · ${currentWorkspace.path}` : t('settings.permissions.workspaceEmpty')}
                    </div>
                </div>
            </SettingsCard>
            <div data-settings-anchor="permissions-tools">
                <SectionTitle title={t('settings.permissions.toolsHeading')} description={t('settings.permissions.toolsDescription')} />
                <ToolPermissionsPanel workspaceId={currentWorkspace?.id} />
            </div>
        </SettingsPage>
    );
}

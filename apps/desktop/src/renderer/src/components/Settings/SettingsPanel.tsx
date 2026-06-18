// 设置面板 - 模态包装器, 内容由 SettingsContent 提供.

import React, { useEffect } from 'react';
import { useSettingsStore } from '../../stores/settings-store';
import { useI18n } from '../../i18n';
import { SettingsContent } from './SettingsContent';

export function SettingsPanel(): React.JSX.Element {
    const { isOpen, closeSettings, clearWriteError } = useSettingsStore();
    const { t } = useI18n();

    useEffect(() => {
        if (!isOpen) clearWriteError();
    }, [isOpen, clearWriteError]);

    if (!isOpen) return <></>;

    return (
        <div className="settings-backdrop-enter fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6 backdrop-blur-[1px]">
            <div
                className="settings-shell-enter flex h-[min(760px,calc(100vh-48px))] w-[min(1040px,calc(100vw-48px))] overflow-hidden rounded-2xl border border-[var(--mm-border)] bg-[var(--mm-bg-main)] shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
                role="dialog"
                aria-modal="true"
                aria-label={t('settings.title')}
            >
                <SettingsContent onClose={closeSettings} />
            </div>
        </div>
    );
}

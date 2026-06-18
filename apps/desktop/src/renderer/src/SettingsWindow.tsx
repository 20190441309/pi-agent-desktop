// 独立设置窗口 — 不含模态 chrome, 自带 I18nProvider 和主题初始化.

import React, { useEffect } from 'react';
import { useSettingsStore } from './stores/settings-store';
import { I18nProvider } from './i18n';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { SettingsContent } from './components/Settings/SettingsContent';
import { applyTheme, watchSystemTheme, type Theme } from './utils/theme';

function SettingsShell(): React.JSX.Element {
    const { settings, loadPiConfig } = useSettingsStore();

    useEffect(() => {
        const theme = (settings.theme as Theme) || 'system';
        applyTheme(theme);

        if (theme === 'system') {
            const unwatch = watchSystemTheme(() => {
                applyTheme('system');
            });
            return unwatch;
        }
        return;
    }, [settings.theme]);

    useEffect(() => {
        void loadPiConfig();
    }, [loadPiConfig]);

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[var(--mm-bg-main)]">
            <SettingsContent />
        </div>
    );
}

export default function SettingsWindow(): React.JSX.Element {
    return (
        <I18nProvider>
            <ErrorBoundary>
                <SettingsShell />
            </ErrorBoundary>
        </I18nProvider>
    );
}

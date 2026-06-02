// Settings Store - Manages application settings
// v1.0.5: AppSettings / PiModelInfo 跟 @shared 重复, 改用 re-export + 本地 alias 保留 store 旧代码
// v1.0.6: console 换 logger
// v1.0.9: 写错误经 _onError listener 走 IpcError 路径, SettingsPanel 翻译后显示

import { create } from 'zustand';
import { isIpcError, type AppSettings, type IpcError } from '@shared';
import { logger } from '../utils/logger';

export type { AppSettings };

export interface PiModelInfo {
  id: string;
  name: string;
  provider: string;
  providerName: string;
  description: string;
  maxTokens?: number;
}

/** loadPiConfig 返的形状 (主进程 settings:load-pi-config 还没强类型化, 临时结构) */
interface PiConfigPayload {
  models?: PiModelInfo[];
  currentModel?: { model: string; provider: string } | null;
}

interface SettingsState {
  settings: AppSettings;
  isOpen: boolean;
  piModels: PiModelInfo[] | null;
  /** v1.0.9: 最近一次写错误 (IpcError | string | null). SettingsPanel 订阅后翻译显示. */
  lastWriteError: IpcError | string | null;

  // Actions
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  toggleSettings: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  loadPiConfig: () => Promise<void>;
  /** 清除最近写错误 (用户点 close 后清) */
  clearWriteError: () => void;
}

const defaultSettings: AppSettings = {
  theme: 'light',
  fontSize: 14,
  model: 'gpt-4',
  provider: 'openai',
  temperature: 0.7,
  maxTokens: 4096,
  autoSave: true,
  showLineNumbers: true,
  wordWrap: true
};

/** 内部 helper: 把 setSettings 返的 (void | IpcError) / throw 统一成 lastWriteError */
function reportWriteError(e: unknown): IpcError | string {
  if (isIpcError(e)) return e;
    return String(e);
}

export const useSettingsStore = create<SettingsState>((set) => {
  // Load persisted settings from main process
  const loadSettings = async () => {
    try {
      if (window.piAPI) {
        const persisted = await window.piAPI.getSettings();
        set({ settings: { ...defaultSettings, ...persisted } });
      }
    } catch (e) {
      logger.error('[settings-store] Failed to load settings:', e);
    }
  };
  loadSettings();

  return {
    settings: defaultSettings,
    isOpen: false,
    piModels: null,
    lastWriteError: null,

    // 从 Pi CLI 加载本地配置
    loadPiConfig: async () => {
      try {
        if (window.piAPI && window.piAPI.loadPiConfig) {
          const config = (await window.piAPI.loadPiConfig()) as PiConfigPayload;
          if (config.models && config.models.length > 0) {
            set({ piModels: config.models });
          }
          // 如果 Pi 配置中有当前模型信息，自动更新
          if (config.currentModel) {
            set((state) => ({
              settings: {
                ...state.settings,
                model: config.currentModel!.model,
                provider: config.currentModel!.provider,
              },
            }));
          }
        }
      } catch (e) {
        logger.info('[settings-store] Pi config not available, using defaults:', e);
      }
    },

    updateSettings: (updates: Partial<AppSettings>) => {
      set((state) => {
        const newSettings = { ...state.settings, ...updates };
        if (window.piAPI) {
          // v1.0.6.1 后 setSettings 不再 throw, 但仍 try/catch 兜底老 throw 路径
          window.piAPI.setSettings(updates)
            .then((result) => {
              if (isIpcError(result)) {
                set({ lastWriteError: result });
              }
            })
            .catch((e) => {
              logger.error('[settings-store] setSettings failed:', e);
              set({ lastWriteError: reportWriteError(e) });
            });
        }
        return { settings: newSettings };
      });
    },

    resetSettings: () => {
      set({ settings: defaultSettings });
      if (window.piAPI) {
        window.piAPI.setSettings(defaultSettings)
          .then((result) => {
            if (isIpcError(result)) {
              set({ lastWriteError: result });
            }
          })
          .catch((e) => {
            logger.error('[settings-store] setSettings (reset) failed:', e);
            set({ lastWriteError: reportWriteError(e) });
          });
      }
    },

    toggleSettings: () => {
      set((state) => ({ isOpen: !state.isOpen }));
    },

    openSettings: () => {
      set({ isOpen: true });
    },

    closeSettings: () => {
      set({ isOpen: false });
    },

    clearWriteError: () => {
      set({ lastWriteError: null });
    },
  };
});
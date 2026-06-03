import { create } from 'zustand';
import type { AIConfig } from '@qiuai/shared';

export interface AppSettings {
  aiProviders: {
    anthropic: AIConfig;
    openai: AIConfig;
    deepseek: AIConfig;
    glm: AIConfig;
    ollama: AIConfig;
  };
  activeProvider: 'anthropic' | 'openai' | 'deepseek' | 'glm' | 'ollama';
  dataKeywords: string[];
}

const STORAGE_KEY = 'qiuai_settings';

function migrateDeepSeekModel(model: string | undefined): string {
  if (!model || model === 'deepseek-chat' || model === 'deepseek-reasoner' || model === 'deepseek-v3') {
    return 'deepseek-v4-pro';
  }
  return model;
}

export function getDefaultSettings(): AppSettings {
  return {
    aiProviders: {
      anthropic: {
        provider: 'anthropic',
        apiKey: '',
        model: 'claude-sonnet-4-6',
        temperature: 0.7,
        maxTokens: 8192,
      },
      openai: {
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 8192,
      },
      deepseek: {
        provider: 'openai',
        apiKey: '',
        model: 'deepseek-v4-pro',
        baseURL: 'https://api.deepseek.com',
        temperature: 0.7,
        maxTokens: 8192,
      },
      glm: {
        provider: 'openai',
        apiKey: '',
        model: 'glm-4.7',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
        temperature: 0.7,
        maxTokens: 8192,
      },
      ollama: {
        provider: 'ollama',
        apiKey: '',
        model: 'qwen2.5:72b',
        baseURL: 'http://localhost:11434',
        temperature: 0.7,
        maxTokens: 4096,
      },
    },
    activeProvider: 'deepseek',
    dataKeywords: ['经费', '指标', '参数', '百分比', '万元', '人月', '台套'],
  };
}

function normalizeSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
  const defaults = getDefaultSettings();
  const next: AppSettings = {
    aiProviders: {
      anthropic: { ...defaults.aiProviders.anthropic, ...(raw?.aiProviders?.anthropic ?? {}) },
      openai: { ...defaults.aiProviders.openai, ...(raw?.aiProviders?.openai ?? {}) },
      deepseek: { ...defaults.aiProviders.deepseek, ...(raw?.aiProviders?.deepseek ?? {}) },
      glm: { ...defaults.aiProviders.glm, ...(raw?.aiProviders?.glm ?? {}) },
      ollama: { ...defaults.aiProviders.ollama, ...(raw?.aiProviders?.ollama ?? {}) },
    },
    activeProvider: raw?.activeProvider ?? defaults.activeProvider,
    dataKeywords:
      raw?.dataKeywords && raw.dataKeywords.length > 0 ? raw.dataKeywords : defaults.dataKeywords,
  };

  next.aiProviders.deepseek = {
    ...next.aiProviders.deepseek,
    provider: 'openai',
    baseURL: next.aiProviders.deepseek.baseURL || 'https://api.deepseek.com',
    model: migrateDeepSeekModel(next.aiProviders.deepseek.model),
  };

  return next;
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeSettings(JSON.parse(raw) as Partial<AppSettings>);
    }
  } catch {
    // ignore
  }

  return getDefaultSettings();
}

function saveSettingsToDisk(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
}

interface SettingsState {
  settings: AppSettings;
  updateProviderConfig: (provider: string, config: Partial<AIConfig>) => void;
  setActiveProvider: (provider: AppSettings['activeProvider']) => void;
  setDataKeywords: (keywords: string[]) => void;
  save: () => void;
  getActiveConfig: () => AIConfig;
  getWritingConfig: () => AIConfig;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: loadSettings(),

  updateProviderConfig: (provider, config) =>
    set((state) => {
      const key = provider as keyof AppSettings['aiProviders'];
      const mergedSettings = normalizeSettings({
        ...state.settings,
        aiProviders: {
          ...state.settings.aiProviders,
          [key]: { ...state.settings.aiProviders[key], ...config },
        },
      });

      return {
        settings: mergedSettings,
      };
    }),

  setActiveProvider: (provider) =>
    set((state) => ({
      settings: { ...state.settings, activeProvider: provider },
    })),

  setDataKeywords: (keywords) =>
    set((state) => ({
      settings: { ...state.settings, dataKeywords: keywords },
    })),

  save: () => {
    const { settings } = get();
    saveSettingsToDisk(settings);
  },

  getActiveConfig: () => {
    const { settings } = get();
    return settings.aiProviders[settings.activeProvider];
  },

  getWritingConfig: () => {
    const { settings } = get();
    return settings.aiProviders.deepseek;
  },
}));

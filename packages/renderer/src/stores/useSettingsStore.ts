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

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return getDefaultSettings();
}

function saveSettingsToDisk(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
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
        provider: 'openai', // DeepSeek uses OpenAI-compatible API
        apiKey: '',
        model: 'deepseek-chat',
        baseURL: 'https://api.deepseek.com',
        temperature: 0.7,
        maxTokens: 8192,
      },
      glm: {
        provider: 'openai',
        apiKey: '', // 在此填入你的API Key
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
    activeProvider: 'glm',
    dataKeywords: ['经费', '指标', '参数', '百分比', '万元', '人月', '台套'],
  };
}

interface SettingsState {
  settings: AppSettings;
  updateProviderConfig: (provider: string, config: Partial<AIConfig>) => void;
  setActiveProvider: (provider: AppSettings['activeProvider']) => void;
  setDataKeywords: (keywords: string[]) => void;
  save: () => void;
  getActiveConfig: () => AIConfig;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: loadSettings(),

  updateProviderConfig: (provider, config) =>
    set((state) => {
      const key = provider as keyof AppSettings['aiProviders'];
      return {
        settings: {
          ...state.settings,
          aiProviders: {
            ...state.settings.aiProviders,
            [key]: { ...state.settings.aiProviders[key], ...config },
          },
        },
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
}));

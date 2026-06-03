import type { AIConfig, PolishRequest } from '@qiuai/shared';
import { anthropicProvider } from './providers/anthropicProvider.js';
import { openaiProvider } from './providers/openaiProvider.js';
import { ollamaProvider } from './providers/ollamaProvider.js';

function getProvider(config: AIConfig) {
  switch (config.provider) {
    case 'anthropic':
      return anthropicProvider;
    case 'openai':
      return openaiProvider;
    case 'ollama':
      return ollamaProvider;
    default:
      return openaiProvider;
  }
}

const polishPrompts: Record<PolishRequest['style'], string> = {
  formal:
    '请将以下文本改写为正式、规范的项目报告/论文表达，保持原意，不夸张，不口语化，不虚构事实，不破坏原有术语、编号与引用关系。',
  academic:
    '请将以下文本润色为更符合论文、科研报告与正式申报材料的写法，增强严谨性、逻辑性和专业性，同时保持原意，不新增未经验证的信息。',
  concise:
    '请将以下文本精简为更符合正式论文与项目报告风格的表达，删除冗余和口语化表述，保留核心观点、术语、数据和引用关系。',
  expand:
    '请在不虚构事实、数据、来源和结论的前提下，将以下文本扩写为更完整的论文/项目报告段落，补足必要的论证、衔接与正式表达。',
};

class PolishService {
  private readonly systemPrompt =
    '你是一位专业的论文与项目报告文字编辑助手。请只对用户提供的原文进行规范化润色，不虚构事实，不凭空补数据，不删除关键术语、编号、引用与结论关系。';

  async polish(request: PolishRequest): Promise<string> {
    const instruction = polishPrompts[request.style] || polishPrompts.formal;
    const prompt = `${instruction}\n\n原文：\n${request.originalText}\n\n改写后：`;
    const provider = getProvider(request.aiConfig);
    const config: AIConfig = {
      ...request.aiConfig,
      systemPrompt: request.aiConfig.systemPrompt || this.systemPrompt,
    };

    try {
      let result = '';
      for await (const chunk of provider.generateText(prompt, config)) {
        result += chunk;
      }
      const normalized = result.trim();

      if (!normalized) {
        throw new Error('AI 未返回有效内容，请稍后重试。');
      }

      if (/^\[(错误|API错误)/.test(normalized)) {
        throw new Error(normalized);
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error('润色失败，请检查模型配置或网络连接。', {
        cause: error,
      });
    }
  }
}

export const polishService = new PolishService();

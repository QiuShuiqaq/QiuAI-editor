import type { PolishRequest } from '@qiuai/shared';
import { anthropicProvider } from './providers/anthropicProvider.js';
import { openaiProvider } from './providers/openaiProvider.js';
import { ollamaProvider } from './providers/ollamaProvider.js';

const polishPrompts: Record<string, string> = {
  formal: '请将以下文本改写为更正式的公文风格，使用规范的学术用语，保持原意不变：',
  academic: '请将以下文本改写为更学术化的表达，增强专业性和严谨性，保持原意不变：',
  concise: '请将以下文本进行精简，去除冗余表达，保留核心信息：',
  expand: '请将以下文本进行扩展，增加必要的细节和论据支撑，使内容更加充实：',
};

class PolishService {
  async polish(request: PolishRequest): Promise<string> {
    const instruction = polishPrompts[request.style] || polishPrompts.formal;
    const prompt = `${instruction}\n\n原文：\n${request.originalText}\n\n改写后的文本：`;

    const { aiConfig } = request;
    let provider;
    switch (aiConfig.provider) {
      case 'anthropic': provider = anthropicProvider; break;
      case 'openai': provider = openaiProvider; break;
      case 'ollama': provider = ollamaProvider; break;
      default: provider = openaiProvider; break;
    }

    try {
      let result = '';
      for await (const chunk of provider.generateText(prompt, aiConfig)) {
        result += chunk;
      }
      return result || request.originalText;
    } catch {
      // Fallback: return original with indication
      return `[润色失败] ${request.originalText}`;
    }
  }
}

export const polishService = new PolishService();

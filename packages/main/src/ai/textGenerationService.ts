import type { AIConfig, TextGenRequest } from '@qiuai/shared';
import { anthropicProvider } from './providers/anthropicProvider.js';
import { openaiProvider } from './providers/openaiProvider.js';
import { ollamaProvider } from './providers/ollamaProvider.js';
import type { TextGenerationProvider } from './providers/baseProvider.js';

function getProvider(config: AIConfig): TextGenerationProvider | null {
  switch (config.provider) {
    case 'anthropic':
      return anthropicProvider;
    case 'openai':
      return openaiProvider;
    case 'ollama':
      return ollamaProvider;
    default:
      if (config.baseURL) return openaiProvider;
      return null;
  }
}

function buildPrompt(request: TextGenRequest, promptAddendum = ''): string {
  const {
    sectionTitle,
    headingPath,
    referenceChunks,
    neighborSummaries,
    documentPlan,
    dataKeywords,
  } = request;

  const headingContext = headingPath.join(' > ');
  const refText = referenceChunks.map((chunk) => chunk.text).join('\n\n');
  const neighborContext = neighborSummaries.join('\n');
  const dataInstructions =
    dataKeywords.length > 0
      ? `\n\n【重要】以下类型的数据请用 [REVIEW:说明] 标记包裹，便于后续审核：${dataKeywords.join('、')}`
      : '';

  return `请撰写申报书的“${sectionTitle}”章节内容。

## 文档全局规划
${documentPlan || '无'}

## 章节路径
${headingContext}

## 邻近章节摘要（保持连续性）
${neighborContext || '无（这是第一个章节）'}

## 参考资料（请严格基于这些材料撰写，不要编造数据）
${refText || '无特定参考资料，请基于专业知识谨慎撰写。'}

## 写作要求
1. 使用正式、专业的学术语言，符合中国科研项目申报书规范
2. 数据和事实要准确，引用材料中的数据时要忠实于原文
3. 段落结构清晰，逻辑严密
4. 不要编造数据，如果没有确切数据，使用合理的描述性语言
5. 使用中文撰写
${dataInstructions}

${promptAddendum}

请直接开始撰写章节“${sectionTitle}”的内容：`;
}

export interface GenerationResult {
  content: string;
  provider: string;
  model: string;
}

class TextGenerationService {
  async *generateSection(
    request: TextGenRequest,
    promptAddendum = ''
  ): AsyncGenerator<string, GenerationResult> {
    const { aiConfig } = request;
    const provider = getProvider(aiConfig);

    if (!provider) {
      yield `[错误] 不支持的 AI 提供商: ${aiConfig.provider}。请在 AI 设置中配置。`;
      return { content: '', provider: 'error', model: '' };
    }

    const prompt = buildPrompt(request, promptAddendum);
    let fullContent = '';

    try {
      for await (const chunk of provider.generateText(prompt, aiConfig)) {
        fullContent += chunk;
        yield chunk;
      }
    } catch (error: any) {
      yield `\n\n[生成出错] ${error.message || String(error)}`;
    }

    return {
      content: fullContent,
      provider: provider.name,
      model: aiConfig.model,
    };
  }
}

export const textGenerationService = new TextGenerationService();

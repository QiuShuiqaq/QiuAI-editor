import type { AIConfig } from '@qiuai/shared';
import type { TextGenerationProvider } from './baseProvider.js';

export class AnthropicProvider implements TextGenerationProvider {
  name = 'anthropic';
  maxContextTokens = 200000;

  async *generateText(prompt: string, config: AIConfig): AsyncGenerator<string, void, unknown> {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      yield '[错误] 请先在AI设置中配置Anthropic API Key';
      return;
    }

    const baseURL = config.baseURL || 'https://api.anthropic.com';
    const response = await fetch(`${baseURL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-sonnet-4-6',
        max_tokens: config.maxTokens || 8192,
        temperature: config.temperature ?? 0.7,
        system: '你是一位专业的科研项目申报书撰写专家。请使用正式、专业的学术语言，遵循中国科研项目申报书规范进行撰写。数据务必准确，结构清晰，逻辑严密。',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      yield `[API错误 ${response.status}] ${err}`;
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield '[错误] 无法读取流式响应';
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const text = parsed?.delta?.text || parsed?.content_block?.text || '';
          if (text) yield text;
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }
  }
}

export const anthropicProvider = new AnthropicProvider();

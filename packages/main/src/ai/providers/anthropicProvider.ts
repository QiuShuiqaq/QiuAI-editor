import type { AIConfig } from '@qiuai/shared';
import type { TextGenerationProvider } from './baseProvider.js';

export class AnthropicProvider implements TextGenerationProvider {
  name = 'anthropic';
  maxContextTokens = 200000;

  private readonly defaultSystemPrompt =
    '你是一位专业的科研项目与正式报告写作助手。请使用规范、准确、清晰的中文表达，忠于输入内容，不虚构事实。';

  async *generateText(prompt: string, config: AIConfig): AsyncGenerator<string, void, unknown> {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      yield '[错误] 请先在AI设置中配置 Anthropic API Key';
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
        system: config.systemPrompt || this.defaultSystemPrompt,
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
          // Ignore malformed chunks.
        }
      }
    }
  }
}

export const anthropicProvider = new AnthropicProvider();

import type { AIConfig } from '@qiuai/shared';
import type { TextGenerationProvider } from './baseProvider.js';

export class OpenAIProvider implements TextGenerationProvider {
  name = 'openai';
  maxContextTokens = 128000;

  private readonly defaultSystemPrompt =
    '你是一位专业的科研项目与正式报告写作助手。请使用规范、准确、清晰的中文表达，忠于输入内容，不虚构事实。';

  async *generateText(prompt: string, config: AIConfig): AsyncGenerator<string, void, unknown> {
    const inferredApiKey =
      config.baseURL?.includes('deepseek.com')
        ? process.env.DEEPSEEK_API_KEY
        : config.baseURL?.includes('bigmodel.cn')
          ? process.env.GLM_API_KEY
          : process.env.OPENAI_API_KEY;
    const apiKey = config.apiKey || inferredApiKey;
    if (!apiKey) {
      yield '[错误] 请先在AI设置中配置 API Key';
      return;
    }

    const base = config.baseURL || 'https://api.openai.com';
    const hasVersion = /\/v\d+\/?$/.test(base);
    const url = hasVersion ? `${base.replace(/\/+$/, '')}/chat/completions` : `${base.replace(/\/+$/, '')}/v1/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o',
        max_tokens: config.maxTokens || 8192,
        temperature: config.temperature ?? 0.7,
        messages: [
          {
            role: 'system',
            content: config.systemPrompt || this.defaultSystemPrompt,
          },
          { role: 'user', content: prompt },
        ],
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
    let emittedContent = false;
    let reasoningBuffer = '';

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
          const delta = parsed?.choices?.[0]?.delta || {};
          const content = delta?.content || '';
          const reasoning = delta?.reasoning_content || '';
          if (content) {
            emittedContent = true;
            yield content;
          } else if (reasoning) {
            reasoningBuffer += reasoning;
          }
        } catch {
          // Ignore malformed chunks.
        }
      }
    }

    if (!emittedContent && reasoningBuffer) {
      yield reasoningBuffer;
    }
  }
}

export const openaiProvider = new OpenAIProvider();

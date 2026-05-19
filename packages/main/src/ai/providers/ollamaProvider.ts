import type { AIConfig } from '@qiuai/shared';
import type { TextGenerationProvider } from './baseProvider.js';

export class OllamaProvider implements TextGenerationProvider {
  name = 'ollama';
  maxContextTokens = 32768;

  async *generateText(prompt: string, config: AIConfig): AsyncGenerator<string, void, unknown> {
    const baseURL = config.baseURL || 'http://localhost:11434';

    const response = await fetch(`${baseURL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model || 'qwen2.5:72b',
        prompt,
        stream: true,
        options: {
          temperature: config.temperature ?? 0.7,
          num_predict: config.maxTokens || 4096,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      yield `[Ollama错误 ${response.status}] 请确认Ollama服务已启动（ollama serve）。${err}`;
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield '[错误] 无法读取响应';
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
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) yield parsed.response;
          if (parsed.done) return;
        } catch {
          // Skip malformed lines
        }
      }
    }
  }
}

export const ollamaProvider = new OllamaProvider();

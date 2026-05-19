import type { AIConfig, TextGenRequest, PolishRequest } from '@qiuai/shared';

// Parse API error response into user-friendly message
function formatAPIError(status: number, rawBody: string): string {
  try {
    const err = JSON.parse(rawBody);
    const msg = err?.error?.message || err?.message || rawBody;
    return `[API错误 ${status}] ${msg}`;
  } catch {
    return `[API错误 ${status}] ${rawBody.slice(0, 200)}`;
  }
}

// Direct API call for Anthropic (Claude) - streaming
async function* callAnthropicStream(prompt: string, config: AIConfig): AsyncGenerator<string> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    yield '[错误] 未配置Anthropic API Key，请在AI设置中配置';
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
      system: '你是一位专业的科研项目申报书撰写专家。请使用正式、专业的学术语言，遵循中国科研项目申报书规范撰写。',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    yield formatAPIError(response.status, errText);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) { yield '[错误] 无法读取响应流'; return; }

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
      } catch { /* skip */ }
    }
  }
}

// Direct API call for OpenAI-compatible (GPT, DeepSeek, etc.) - streaming
async function* callOpenAIStream(prompt: string, config: AIConfig): AsyncGenerator<string> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    yield '[错误] 未配置API Key，请在AI设置中配置';
    return;
  }

  const base = config.baseURL || 'https://api.openai.com';
  // Handle providers with version already in baseURL (e.g. Zhipu's /v4/)
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
          content: '你是一位专业的科研项目申报书撰写专家。请使用正式、专业的学术语言，遵循中国科研项目申报书规范撰写。',
        },
        { role: 'user', content: prompt },
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    yield formatAPIError(response.status, errText);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) { yield '[错误] 无法读取响应流'; return; }

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
        const text = parsed?.choices?.[0]?.delta?.content || '';
        if (text) yield text;
      } catch { /* skip */ }
    }
  }
}

// Direct API call for Ollama - streaming
async function* callOllamaStream(prompt: string, config: AIConfig): AsyncGenerator<string> {
  const baseURL = config.baseURL || 'http://localhost:11434';

  const response = await fetch(`${baseURL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model || 'qwen2.5:72b',
      prompt,
      stream: true,
      options: { temperature: config.temperature ?? 0.7, num_predict: config.maxTokens || 4096 },
    }),
  }).catch(() => null);

  if (!response || !response.ok) {
    yield '[错误] 无法连接Ollama服务。请确认 ollama serve 已启动。';
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) { yield '[错误] 无法读取响应'; return; }

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
      } catch { /* skip */ }
    }
  }
}

// Build the prompt
function buildPrompt(request: TextGenRequest): string {
  const { sectionTitle, headingPath, referenceChunks, neighborSummaries, documentPlan, dataKeywords } = request;

  const headingContext = headingPath.join(' > ');
  const refText = referenceChunks.map((c) => c.text).join('\n\n');
  const neighborContext = neighborSummaries.join('\n');

  const dataInstructions =
    dataKeywords.length > 0
      ? `\n\n【重要】以下类型的数据请用 [REVIEW:说明] 标记包裹，便于后续审核：${dataKeywords.join('、')}`
      : '';

  return `请撰写申报书的"${sectionTitle}"章节内容。

## 文档全局规划
${documentPlan || '无'}

## 章节路径
${headingContext}

## 邻近章节摘要（保持连续性）
${neighborContext || '无'}

## 参考资料（严格基于材料，不编造数据）
${refText || '无'}

## 要求
1. 正式专业的学术语言，符合中国科研项目申报书规范
2. 数据准确，忠实原文
3. 结构清晰，逻辑严密
4. 中文撰写
${dataInstructions}

请撰写"${sectionTitle}"：`;
}

// Build polish prompt
function buildPolishPrompt(request: PolishRequest): string {
  const styleInstructions: Record<string, string> = {
    formal: '请将以下文本改写为更加正式的公文风格，使用规范的学术用语，保持原意不变：',
    academic: '请将以下文本改写为更加学术化的表达，增强专业性和严谨性，保持原意不变：',
    concise: '请将以下文本进行精简，去除冗余表达，保留核心信息：',
    expand: '请将以下文本进行扩展，增加必要的细节和论据支撑，使内容更加充实：',
  };

  const instruction = styleInstructions[request.style] || styleInstructions.formal;
  return `${instruction}\n\n原文：\n${request.originalText}\n\n改写后：`;
}

// Main generation function - returns streaming generator
export async function* streamGenerateText(
  request: TextGenRequest
): AsyncGenerator<string> {
  const { aiConfig } = request;
  const prompt = buildPrompt(request);

  if (!aiConfig.apiKey && aiConfig.provider !== 'ollama') {
    yield `[提示] 未配置API Key。请在工具栏点击 ⚙ 图标打开"AI模型配置"，填入你的API密钥。

支持的AI供应商：
• Anthropic Claude — 从 console.anthropic.com 获取API Key
• OpenAI GPT — 从 platform.openai.com 获取API Key
• DeepSeek — 从 platform.deepseek.com 获取API Key
• 本地Ollama — 免费，需本地部署

配置完成后即可使用真实的AI生成功能。当前为占位模式。`;
    return;
  }

  switch (aiConfig.provider) {
    case 'anthropic':
      yield* callAnthropicStream(prompt, aiConfig);
      break;
    case 'openai':
      yield* callOpenAIStream(prompt, aiConfig);
      break;
    case 'ollama':
      yield* callOllamaStream(prompt, aiConfig);
      break;
    default:
      yield* callOpenAIStream(prompt, aiConfig);
  }
}

// Polish function - returns the polished text
export async function polishText(request: PolishRequest): Promise<string> {
  const { aiConfig } = request;
  const prompt = buildPolishPrompt(request);

  if (!aiConfig.apiKey && aiConfig.provider !== 'ollama') {
    return `[提示] 请先在AI设置中配置API Key以使用真实润色功能。\n\n原文：\n${request.originalText}`;
  }

  try {
    // Collect all chunks from streaming and return as single string
    let result = '';
    const generator =
      aiConfig.provider === 'anthropic'
        ? callAnthropicStream(prompt, aiConfig)
        : aiConfig.provider === 'ollama'
        ? callOllamaStream(prompt, aiConfig)
        : callOpenAIStream(prompt, aiConfig);

    for await (const chunk of generator) {
      result += chunk;
    }
    return result || request.originalText;
  } catch {
    return `[润色失败] 请检查API Key和网络连接。\n\n原文：\n${request.originalText}`;
  }
}

// Real AI image generation
export async function generateImage(prompt: string, config: { provider: string; apiKey?: string; model?: string; baseURL?: string }): Promise<string | null> {
  const apiKey = config.apiKey;
  if (!apiKey) return null;

  try {
    if (config.provider === 'openai') {
      const baseURL = config.baseURL || 'https://api.openai.com';
      const response = await fetch(`${baseURL}/v1/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: config.model || 'dall-e-3', prompt, n: 1, size: '1024x1024', response_format: 'b64_json' }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data?.data?.[0]?.b64_json || null;
    }
    // For other providers, return null (use placeholder)
    return null;
  } catch {
    return null;
  }
}

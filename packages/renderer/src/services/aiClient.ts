import {
  type AIChatAction,
  type AIChatRequest,
  type AIChatResponse,
  type AIConfig,
  IPC_CHANNELS,
  type IPCResponse,
  type PolishRequest,
  type TextGenChunk,
  type TextGenerationResult,
  type TextGenRequest,
} from '@qiuai/shared';
import { ipcClient } from './ipcClient';

const DEFAULT_WRITING_SYSTEM_PROMPT =
  '你是专业的科研项目与正式报告写作助手。请使用规范、准确、清晰的中文表达，忠于输入内容，不虚构事实。';

const DEFAULT_CHAT_SYSTEM_PROMPT =
  '你是 QiuAI-editor 的 AI 助手。优先自然、准确、简洁地回答用户问题。只有当用户明确要求写作、改写、总结、扩写正文时，才使用正式科研或项目报告写作风格。';

const AGENT_COMMAND_GUIDE = [
  '你可以通过 execute-command 控制编辑器，而不只是改文本。',
  '可用命令包括：save-document、new-document、set-document-title、set-track-revisions。',
  '页面与版式命令包括：set-page-layout、set-page-margins、set-page-orientation、set-columns、set-watermark、clear-watermark、set-page-border。',
  '页眉页脚命令包括：set-header-footer、enter-header-edit、enter-footer-edit、exit-header-footer-edit、set-page-variant。',
  '导出命令包括：export-docx、export-pdf。',
  '整篇写作命令包括：generate-full-paper。这个命令会基于当前已导入的大纲，按照内置论文规范生成完整论文并直接写入编辑区。',
  '基础编辑命令包括：undo、redo、apply-style、set-align、toggle-bold、toggle-italic、toggle-underline、toggle-bullet-list、toggle-ordered-list。',
  '插入类命令包括：insert-table、insert-image-placeholder、insert-page-break、insert-page-number-field、insert-equation-block、insert-auxiliary-block、insert-toc、insert-link-text、remove-link、scroll-to-heading。',
  '当用户要求“保存、导出、改标题、改页边距、改横向纵向、分栏、加水印、加页边框、编辑页眉页脚、切换修订模式”时，应优先使用 execute-command。',
  '当用户要求“根据当前大纲生成整篇论文、全文、完整稿件、初稿”时，应优先使用 execute-command，command 为 generate-full-paper。',
  '如果一个需求需要多步完成，可以返回多个 actions，按执行顺序排列。',
].join('\n');

function isElectronRuntime(): boolean {
  return typeof window !== 'undefined' && 'electronAPI' in window;
}

function formatAPIError(status: number, rawBody: string): string {
  try {
    const err = JSON.parse(rawBody);
    const msg = err?.error?.message || err?.message || rawBody;
    return `[API错误 ${status}] ${msg}`;
  } catch {
    return `[API错误 ${status}] ${rawBody.slice(0, 200)}`;
  }
}

function resolveSystemPrompt(config: AIConfig, fallback: string): string {
  return config.systemPrompt || fallback;
}

async function* callAnthropicStream(
  prompt: string,
  config: AIConfig,
  fallbackSystemPrompt: string
): AsyncGenerator<string> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    yield '[错误] 未配置 Anthropic API Key，请在 AI 设置中填写。';
    return;
  }

  const baseURL = config.baseURL || 'https://api.anthropic.com';
  const response = await fetch(`${baseURL.replace(/\/+$/, '')}/v1/messages`, {
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
      system: resolveSystemPrompt(config, fallbackSystemPrompt),
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
  if (!reader) {
    yield '[错误] 无法读取响应流。';
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) {
        continue;
      }

      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') {
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        const text = parsed?.delta?.text || parsed?.content_block?.text || '';
        if (text) {
          yield text;
        }
      } catch {
        // Ignore malformed stream events.
      }
    }
  }
}

async function* callOpenAIStream(
  prompt: string,
  config: AIConfig,
  fallbackSystemPrompt: string
): AsyncGenerator<string> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    yield '[错误] 未配置 API Key，请在 AI 设置中填写。';
    return;
  }

  const base = config.baseURL || 'https://api.openai.com';
  const hasVersion = /\/v\d+\/?$/.test(base);
  const url = hasVersion
    ? `${base.replace(/\/+$/, '')}/chat/completions`
    : `${base.replace(/\/+$/, '')}/v1/chat/completions`;

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
          content: resolveSystemPrompt(config, fallbackSystemPrompt),
        },
        {
          role: 'user',
          content: prompt,
        },
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
  if (!reader) {
    yield '[错误] 无法读取响应流。';
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let emittedContent = false;
  let reasoningBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) {
        continue;
      }

      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') {
        continue;
      }

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
        // Ignore malformed stream events.
      }
    }
  }

  if (!emittedContent && reasoningBuffer) {
    yield reasoningBuffer;
  }
}

async function* callOllamaStream(
  prompt: string,
  config: AIConfig,
  fallbackSystemPrompt: string
): AsyncGenerator<string> {
  const baseURL = config.baseURL || 'http://localhost:11434';
  const effectivePrompt = `${resolveSystemPrompt(config, fallbackSystemPrompt)}\n\n${prompt}`;

  const response = await fetch(`${baseURL.replace(/\/+$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model || 'qwen2.5:72b',
      prompt: effectivePrompt,
      stream: true,
      options: {
        temperature: config.temperature ?? 0.7,
        num_predict: config.maxTokens || 4096,
      },
    }),
  }).catch(() => null);

  if (!response || !response.ok) {
    yield '[错误] 无法连接 Ollama 服务，请确认 `ollama serve` 已启动。';
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield '[错误] 无法读取响应流。';
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        const parsed = JSON.parse(line);
        if (parsed.response) {
          yield parsed.response;
        }
        if (parsed.done) {
          return;
        }
      } catch {
        // Ignore malformed stream events.
      }
    }
  }
}

function streamByProvider(
  prompt: string,
  config: AIConfig,
  fallbackSystemPrompt: string
): AsyncGenerator<string> {
  if (config.provider === 'anthropic') {
    return callAnthropicStream(prompt, config, fallbackSystemPrompt);
  }

  if (config.provider === 'ollama') {
    return callOllamaStream(prompt, config, fallbackSystemPrompt);
  }

  return callOpenAIStream(prompt, config, fallbackSystemPrompt);
}

function buildPrompt(request: TextGenRequest): string {
  const { sectionTitle, headingPath, referenceChunks, neighborSummaries, documentPlan, dataKeywords } = request;
  const headingContext = headingPath.join(' > ');
  const refText = referenceChunks.map((chunk) => chunk.text).join('\n\n');
  const neighborContext = neighborSummaries.join('\n');
  const dataInstructions =
    dataKeywords.length > 0
      ? `\n\n【重要】以下类型的数据请用 [REVIEW:说明] 标记包裹，便于后续审校：${dataKeywords.join('、')}`
      : '';

  return `请撰写申报书的“${sectionTitle}”章节内容。

## 文档全局规划
${documentPlan || '无'}

## 章节路径
${headingContext || '无'}

## 邻近章节摘要
${neighborContext || '无'}

## 参考资料
${refText || '无'}

## 要求
1. 使用正式、专业、适合科研项目和正式报告的中文表达
2. 内容必须忠于材料，不虚构数据和事实
3. 结构清晰，逻辑严密
4. 保持与上下文章节衔接自然
${dataInstructions}

请开始撰写“${sectionTitle}”：`;
}

function buildPolishPrompt(request: PolishRequest): string {
  const styleInstructions: Record<PolishRequest['style'], string> = {
    formal:
      '请将以下文本改写为正式的科研项目或正式报告写作风格，语言规范、客观、克制，保持原意，不杜撰事实，不破坏原有术语、编号和引用关系：',
    academic:
      '请将以下文本改写为更学术化、适合论文和项目申报书的表达，增强严谨性与专业性，保持原意，不新增未经验证的信息：',
    concise:
      '请将以下文本精简为更符合论文与正式报告风格的表达，删除冗余和口语化内容，保留核心论点、术语、数据与引用关系：',
    expand:
      '请将以下文本扩写为更完整的论文或项目报告风格内容，补充论证与衔接，但不要虚构事实、数据、参考来源或结论：',
  };

  return `${styleInstructions[request.style]}\n\n原文：\n${request.originalText}\n\n改写后：`;
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function normalizeActions(value: unknown): AIChatAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const actions: AIChatAction[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as Record<string, unknown>;
    const type = String(candidate.type || '');
    const reason = typeof candidate.reason === 'string' ? candidate.reason : undefined;

    switch (type) {
      case 'replace-selection':
      case 'append-after-selection':
      case 'insert-text':
      case 'replace-document': {
        const text = String(candidate.text || '');
        if (!text.trim()) {
          continue;
        }
        actions.push({ type, text, reason });
        break;
      }
      case 'execute-command': {
        const command = String(candidate.command || '');
        if (!command.trim()) {
          continue;
        }
        const payload =
          candidate.payload && typeof candidate.payload === 'object'
            ? (candidate.payload as Record<string, unknown>)
            : undefined;
        actions.push({ type, command, payload, reason });
        break;
      }
      default:
        break;
    }
  }

  return actions;
}

function parseAgentResponse(raw: string): AIChatResponse {
  const trimmed = raw.trim();
  const jsonText = extractJsonObject(trimmed);

  if (!jsonText) {
    return {
      message: trimmed,
      actions: [],
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as {
      message?: unknown;
      actions?: unknown;
    };

    return {
      message: typeof parsed.message === 'string' && parsed.message.trim() ? parsed.message.trim() : trimmed,
      actions: normalizeActions(parsed.actions),
    };
  } catch {
    return {
      message: trimmed,
      actions: [],
    };
  }
}

function buildChatPrompt(request: AIChatRequest): string {
  const documentTextPreview =
    request.documentText && request.documentText.trim()
      ? request.documentText.trim().slice(0, 4000)
      : '';

  const contextLines = [
    request.documentTitle ? `当前文档：${request.documentTitle}` : '',
    request.activeSectionTitle ? `当前章节：${request.activeSectionTitle}` : '',
    request.headingPath?.length ? `章节路径：${request.headingPath.join(' > ')}` : '',
    request.documentPlan ? `文档目标：${request.documentPlan}` : '',
    request.selectedText ? `当前选中文本：\n${request.selectedText}` : '',
    documentTextPreview ? `当前文档正文摘录：\n${documentTextPreview}` : '',
  ].filter(Boolean);

  return [
    '请先理解用户当前这条消息，再直接作答。',
    '如果用户只是打招呼、咨询功能、追问操作方法，请像正常聊天助手一样自然回答。',
    '如果用户明确要求你直接修改文档，请返回结构化 JSON，而不是只给建议。',
    'JSON 结构必须是：{"message":"给用户看的说明","actions":[...]}。',
    'actions 允许的 type 只有：replace-selection、append-after-selection、insert-text、replace-document、execute-command。',
    '当用户要求润色、改写、重写选中文本时，优先使用 replace-selection。',
    '当用户要求续写、补一段、追加内容时，优先使用 append-after-selection。',
    '当用户只是提问、不要求修改文档时，actions 返回空数组。',
    '如果用户要求你根据当前大纲直接生成完整论文，不要把整篇正文写进 message；应返回 execute-command，并调用 generate-full-paper。',
    AGENT_COMMAND_GUIDE,
    contextLines.length ? `上下文：\n${contextLines.join('\n')}` : '',
    `用户消息：${request.message}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function runDirectGeneration(request: TextGenRequest): Promise<TextGenerationResult> {
  const prompt = buildPrompt(request);
  let content = '';

  for await (const chunk of streamByProvider(prompt, request.aiConfig, DEFAULT_WRITING_SYSTEM_PROMPT)) {
    content += chunk;
  }

  return {
    content,
    provider: request.aiConfig.provider,
    model: request.aiConfig.model,
  };
}

async function runDirectPolish(request: PolishRequest): Promise<string> {
  const prompt = buildPolishPrompt(request);
  let content = '';

  for await (const chunk of streamByProvider(prompt, request.aiConfig, DEFAULT_WRITING_SYSTEM_PROMPT)) {
    content += chunk;
  }

  return content || request.originalText;
}

async function runDirectChat(request: AIChatRequest): Promise<AIChatResponse> {
  const prompt = buildChatPrompt(request);
  let content = '';

  for await (const chunk of streamByProvider(prompt, request.aiConfig, DEFAULT_CHAT_SYSTEM_PROMPT)) {
    content += chunk;
  }

  return parseAgentResponse(content);
}

export async function generateText(request: TextGenRequest): Promise<TextGenerationResult> {
  const response = await ipcClient.invoke<IPCResponse<TextGenerationResult>>(IPC_CHANNELS.AI_GENERATE_TEXT, request);

  if (response.success && response.data) {
    return response.data;
  }

  if (response.error) {
    throw new Error(response.error);
  }

  if (isElectronRuntime()) {
    throw new Error('桌面端 AI 生成请求未返回有效结果，请检查主进程日志或模型配置。');
  }

  return runDirectGeneration(request);
}

export async function polishText(request: PolishRequest): Promise<string> {
  const response = await ipcClient.invoke<IPCResponse<string>>(IPC_CHANNELS.AI_POLISH_TEXT, request);

  if (response.success && typeof response.data === 'string') {
    return response.data;
  }

  if (response.error) {
    throw new Error(response.error);
  }

  if (isElectronRuntime()) {
    throw new Error('桌面端 AI 润色未返回有效结果，请检查主进程日志或模型配置。');
  }

  return runDirectPolish(request);
}

export async function chatWithAssistant(request: AIChatRequest): Promise<AIChatResponse> {
  const response = await ipcClient.invoke<IPCResponse<AIChatResponse | string>>(IPC_CHANNELS.AI_CHAT, request);

  if (response.success && response.data) {
    if (typeof response.data === 'string') {
      return {
        message: response.data,
        actions: [],
      };
    }

    if (typeof response.data.message === 'string' && Array.isArray(response.data.actions)) {
      return response.data;
    }
  }

  if (response.error) {
    throw new Error(response.error);
  }

  if (isElectronRuntime()) {
    throw new Error('桌面端 AI 助手未返回有效结果，请检查主进程日志或模型配置。');
  }

  return runDirectChat(request);
}

export async function* streamGenerateText(request: TextGenRequest): AsyncGenerator<TextGenChunk> {
  if (isElectronRuntime()) {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const replyChannel = `${IPC_CHANNELS.AI_GENERATE_TEXT_STREAM}:${requestId}`;
    const queue: TextGenChunk[] = [];
    let resolver: (() => void) | null = null;

    const unsubscribe = ipcClient.on(replyChannel, (payload) => {
      queue.push(payload as TextGenChunk);
      if (resolver) {
        const next = resolver;
        resolver = null;
        next();
      }
    });

    ipcClient.send(IPC_CHANNELS.AI_GENERATE_TEXT_STREAM, { requestId, request });

    try {
      while (true) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resolver = resolve;
          });
        }

        const chunk = queue.shift();
        if (!chunk) {
          continue;
        }

        if (chunk.error) {
          throw new Error(chunk.error);
        }

        yield chunk;

        if (chunk.done) {
          break;
        }
      }
    } finally {
      unsubscribe();
    }
    return;
  }

  const prompt = buildPrompt(request);
  let content = '';
  for await (const chunk of streamByProvider(prompt, request.aiConfig, DEFAULT_WRITING_SYSTEM_PROMPT)) {
    content += chunk;
    yield {
      content: chunk,
      done: false,
    };
  }

  yield {
    content: '',
    done: true,
    provider: request.aiConfig.provider,
    model: request.aiConfig.model,
  };
}

export async function generateImage(
  prompt: string,
  config: { provider: string; apiKey?: string; model?: string; baseURL?: string }
): Promise<string | null> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    return null;
  }

  try {
    if (config.provider === 'openai') {
      const baseURL = config.baseURL || 'https://api.openai.com';
      const response = await fetch(`${baseURL.replace(/\/+$/, '')}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: config.model || 'dall-e-3',
          prompt,
          n: 1,
          size: '1024x1024',
          response_format: 'b64_json',
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data?.data?.[0]?.b64_json || null;
    }

    return null;
  } catch {
    return null;
  }
}

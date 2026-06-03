import type { AIChatAction, AIChatRequest, AIChatResponse, AIConfig } from '@qiuai/shared';
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
      return null;
  }
}

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
  '当用户要求“根据大纲生成整篇论文、全文、完整稿件、初稿”时，应优先使用 execute-command，command 为 generate-full-paper。',
  '如果一个需求需要多步完成，可以返回多个 actions，按执行顺序排列。',
].join('\n');

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
    '如果用户只是打招呼、闲聊、问功能怎么用，请像正常聊天助手一样自然回答。',
    '如果用户明确要求你直接修改文档，请返回结构化 JSON，而不是只给建议。',
    'JSON 结构必须是：{"message":"给用户看的说明","actions":[...]}。',
    'actions 允许的 type 只有：replace-selection、append-after-selection、insert-text、replace-document、execute-command。',
    '当用户要求润色、改写、重写选中文本时，优先使用 replace-selection。',
    '当用户要求续写、补一段、追加内容时，优先使用 append-after-selection。',
    '当用户只是提问、不要求改文档时，actions 返回空数组。',
    '如果需要执行命令，只能使用已有编辑命令，command 填命令名，payload 填参数对象。',
    '如果用户要求你根据当前大纲直接生成完整论文，不要自己输出整篇正文到 message；应返回 execute-command，并调用 generate-full-paper。',
    AGENT_COMMAND_GUIDE,
    contextLines.length ? `上下文：\n${contextLines.join('\n')}` : '',
    `用户消息：${request.message}`,
  ]
    .filter(Boolean)
    .join('\n\n');
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

class ChatService {
  private readonly systemPrompt =
    '你是 QiuAI-editor 的 AI 助手兼文档代理。你不是普通聊天框，而是拥有编辑器操作权限的文档 agent。你的首要职责是正确理解用户意图：如果用户只是聊天，就自然回答；如果用户要求你修改文档、调整排版、控制页面、保存或导出，就返回结构化 JSON 动作，并确保动作清晰、克制、可执行。不要在用户未要求时主动重写整篇文档，不要虚构不存在的编辑器能力。';

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    const provider = getProvider(request.aiConfig);
    if (!provider) {
      throw new Error(`不支持的 AI 提供商：${request.aiConfig.provider}`);
    }

    const prompt = buildChatPrompt(request);
    const config: AIConfig = {
      ...request.aiConfig,
      systemPrompt: request.aiConfig.systemPrompt || this.systemPrompt,
    };

    let result = '';
    for await (const chunk of provider.generateText(prompt, config)) {
      result += chunk;
    }

    return parseAgentResponse(result);
  }
}

export const chatService = new ChatService();

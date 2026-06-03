import type { ElectronAPI } from '../types/electron';
import {
  IPC_CHANNELS,
  countWords,
  generateId,
  syncDocumentWithState,
  type AIChatResponse,
  type DraftMeta,
  type ExportRequest,
  type QiuAiDocument,
  type ReferenceMaterial,
  type ReferenceSource,
  type TableData,
} from '@qiuai/shared';
import { buildDocumentHtml } from '../utils/documentHtml';

const isElectron = (): boolean => typeof window !== 'undefined' && 'electronAPI' in window;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const STORAGE_KEY = 'qiuai_drafts';

function loadDrafts(): Record<string, QiuAiDocument> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const drafts = raw ? (JSON.parse(raw) as Record<string, QiuAiDocument>) : {};
    return Object.fromEntries(
      Object.entries(drafts).map(([id, draft]) => [id, syncDocumentWithState(draft)])
    );
  } catch {
    return {};
  }
}

function saveDrafts(drafts: Record<string, QiuAiDocument>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

function getDraftMeta(doc: QiuAiDocument): DraftMeta {
  const normalized = syncDocumentWithState(doc);
  const contentText = JSON.stringify(normalized.editorContent ?? {});

  return {
    id: normalized.id,
    title: normalized.title,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    currentPhase: normalized.currentPhase,
    wordCount: countWords(contentText),
    pageCount: normalized.documentState.pageCount,
  };
}

async function* mockGenerateText(sectionTitle: string): AsyncGenerator<string> {
  const placeholder = `${sectionTitle}

基于相关领域调研与分析，本节将系统阐述“${sectionTitle}”的核心内容。
桌面版会在这里接入真实模型进行流式生成，当前浏览器模式先使用占位文本模拟结果。`;
  const chars = placeholder.split('');
  let buffer = '';

  for (const char of chars) {
    buffer += char;
    if (buffer.length >= 10) {
      yield buffer;
      buffer = '';
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }

  if (buffer) {
    yield buffer;
  }
}

function buildBrowserChatResponse(request: {
  message: string;
  selectedText?: string;
  activeSectionTitle?: string;
  documentTitle?: string;
  documentText?: string;
}): AIChatResponse {
  const input = request.message.trim();
  if (!input) {
    return {
      message: '我在。你可以直接问我问题，或者让我修改当前文档。',
      actions: [],
    };
  }

  const normalized = input.toLowerCase();
  if (['你好', '您好', 'hi', 'hello', '在吗', '在么'].includes(normalized)) {
    return {
      message: '你好，我在。你可以直接和我聊天，也可以让我润色、改写、续写或插入当前文档内容。',
      actions: [],
    };
  }

  const selection = request.selectedText?.trim() || '';
  const wantsRewrite = /(润色|改写|重写|优化|修改一下|学术化)/i.test(input);
  const wantsAppend = /(续写|扩写|补充|接着写|追加|补一段)/i.test(input);
  const wantsInsert = /(插入|添加一段|写一段|补一段正文)/i.test(input);

  if (wantsRewrite && selection) {
    return {
      message: '浏览器调试模式下，我已按你的要求生成一版替换文本，并会直接应用到当前选区。',
      actions: [
        {
          type: 'replace-selection',
          text: `【调试改写】${selection}`,
          reason: '根据用户的改写请求替换当前选中文本',
        },
      ],
    };
  }

  if (wantsAppend && selection) {
    return {
      message: '浏览器调试模式下，我已生成一段续写内容，并会追加到当前选区之后。',
      actions: [
        {
          type: 'append-after-selection',
          text: '\n\n【调试续写】这里是根据当前选中文本补充的延展内容。',
          reason: '根据用户的续写请求追加内容',
        },
      ],
    };
  }

  if (wantsInsert) {
    const sectionHint = request.activeSectionTitle ? `“${request.activeSectionTitle}”` : '当前章节';
    return {
      message: '浏览器调试模式下，我已准备一段新内容，并会直接插入到文档中。',
      actions: [
        {
          type: 'insert-text',
          text: `\n${sectionHint}补充内容：这里是 AI 助手插入的调试文本。\n`,
          reason: '根据用户要求插入新文本',
        },
      ],
    };
  }

  const contextBits = [
    request.documentTitle ? `当前文档：${request.documentTitle}` : '',
    request.activeSectionTitle ? `当前章节：${request.activeSectionTitle}` : '',
    selection ? `已选中文本：${selection.slice(0, 60)}${selection.length > 60 ? '...' : ''}` : '',
    request.documentText ? `正文长度：${request.documentText.length} 字符` : '',
  ].filter(Boolean);

  return {
    message: [
      `浏览器模式下，我先用占位回答这条消息：${input}`,
      contextBits.length ? contextBits.join('；') : '当前没有额外上下文。',
      '桌面模式接入真实模型后，这里会返回真实对话结果；如果你让我改文档，也会返回可执行编辑动作。',
    ].join('\n'),
    actions: [],
  };
}

const browserMocks: Record<string, (...args: any[]) => Promise<any> | any> = {
  [IPC_CHANNELS.FILE_SAVE_DRAFT]: async (doc: QiuAiDocument) => {
    const drafts = loadDrafts();
    const normalized = syncDocumentWithState({
      ...doc,
      updatedAt: new Date().toISOString(),
    });
    drafts[normalized.id] = normalized;
    saveDrafts(drafts);
    return { success: true, data: getDraftMeta(normalized) };
  },

  [IPC_CHANNELS.FILE_OPEN_DRAFT]: async (draftId: string) => {
    const drafts = loadDrafts();
    const doc = drafts[draftId];
    if (!doc) {
      return { success: false, error: '草稿未找到' };
    }
    return { success: true, data: syncDocumentWithState(doc) };
  },

  [IPC_CHANNELS.FILE_LIST_DRAFTS]: async () => {
    const drafts = loadDrafts();
    const metas = Object.values(drafts)
      .map((doc) => getDraftMeta(doc))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { success: true, data: metas };
  },

  [IPC_CHANNELS.FILE_DELETE_DRAFT]: async (draftId: string) => {
    const drafts = loadDrafts();
    delete drafts[draftId];
    saveDrafts(drafts);
    return { success: true };
  },

  [IPC_CHANNELS.FILE_IMPORT_REFERENCE]: async (fileType: string) =>
    new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = fileType === 'pdf' ? '.pdf' : '.docx,.doc';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve({ success: true, data: null });
          return;
        }

        const material: ReferenceMaterial = {
          id: generateId(),
          fileName: file.name,
          filePath: URL.createObjectURL(file),
          fileType: fileType as 'pdf' | 'docx',
          chunks: [
            {
              id: generateId(),
              text: `[浏览器模式] 已加载文件“${file.name}”，大小 ${(file.size / 1024).toFixed(1)} KB。桌面版会继续执行全文解析。`,
              metadata: {},
            },
          ],
        };

        resolve({ success: true, data: material });
      };
      input.click();
    }),

  [IPC_CHANNELS.REFERENCE_IMPORT_DOI]: async (doi: string) => {
    const trimmed = doi.trim();
    if (!trimmed) {
      return { success: false, error: 'DOI 不能为空' };
    }

    const now = new Date().toISOString();
    const source: ReferenceSource = {
      id: generateId(),
      type: 'journal-article',
      title: `浏览器模式 DOI 占位：${trimmed}`,
      authors: [],
      editors: [],
      doi: trimmed,
      keywords: [],
      sourceProvider: 'manual',
      localAttachmentIds: [],
      createdAt: now,
      updatedAt: now,
    };

    return { success: true, data: source };
  },

  [IPC_CHANNELS.AI_GENERATE_TEXT]: async (request: { sectionTitle: string }) => {
    const chunks: string[] = [];
    for await (const chunk of mockGenerateText(request.sectionTitle)) {
      chunks.push(chunk);
    }
    return { success: true, data: { content: chunks.join('') } };
  },

  [IPC_CHANNELS.AI_POLISH_TEXT]: async (request: { originalText: string; style: string }) => {
    const examples: Record<string, string> = {
      formal: `【正式报告风格】${request.originalText}\n\n（浏览器模式下使用占位结果，桌面版会由模型实时润色。）`,
      academic: `【学术化表达】${request.originalText}\n\n（浏览器模式下使用占位结果，桌面版会由模型实时润色。）`,
      concise: `【精简版】${request.originalText.slice(0, 100)}...\n\n（浏览器模式下使用占位结果，桌面版会由模型实时润色。）`,
      expand: `【扩写版】${request.originalText}\n\n（浏览器模式下使用占位结果，桌面版会由模型实时润色。）`,
    };
    return { success: true, data: examples[request.style] || examples.formal };
  },

  [IPC_CHANNELS.AI_CHAT]: async (request: {
    message: string;
    selectedText?: string;
    activeSectionTitle?: string;
    documentTitle?: string;
    documentText?: string;
  }) => {
    return { success: true, data: buildBrowserChatResponse(request) };
  },

  [IPC_CHANNELS.AI_GENERATE_IMAGE]: async () => ({ success: true, data: { base64: '' } }),

  [IPC_CHANNELS.AI_PROCESS_TABLE]: async (request: { csvData: string; headers: string[] }) => {
    const lines = request.csvData.trim().split('\n');
    const rows = lines.slice(1).map((line) => line.split(',').map((cell) => cell.trim()));
    return { success: true, data: { headers: request.headers, rows } as TableData };
  },

  [IPC_CHANNELS.EXPORT_DOCX]: async (payload: ExportRequest) => {
    const doc = payload.doc;
    const html = buildDocumentHtml(doc);
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, `${doc.title || '项目报告'}.doc`);
    return { success: true, data: 'browser-download' };
  },

  [IPC_CHANNELS.EXPORT_PDF]: async (payload: ExportRequest) => {
    const doc = payload.doc;
    const html = buildDocumentHtml(doc);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
    return { success: true, data: 'browser-print' };
  },
};

class IPCClient {
  private getAPI(): ElectronAPI | null {
    if (isElectron()) {
      return window.electronAPI;
    }
    return null;
  }

  async invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    const api = this.getAPI();
    if (api) {
      return api.invoke<T>(channel, ...args);
    }

    const mock = browserMocks[channel];
    if (mock) {
      return mock(...args) as Promise<T>;
    }

    console.warn(`[IPC] No mock for channel: ${channel}`);
    return { success: false, error: 'Browser mode: channel not available' } as T;
  }

  send(channel: string, ...args: unknown[]): void {
    const api = this.getAPI();
    if (api) {
      api.send(channel, ...args);
    }
  }

  on(channel: string, callback: (...args: unknown[]) => void): () => void {
    const api = this.getAPI();
    if (api) {
      return api.on(channel, callback);
    }
    return () => {};
  }
}

export const ipcClient = new IPCClient();

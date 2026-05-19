import {
  IPC_CHANNELS,
  type IPCResponse,
  type DraftMeta,
  type QiuAiDocument,
  type ReferenceMaterial,
  type TableData,
  generateId,
  WritingPhase,
} from '@qiuai/shared';
import type { ElectronAPI } from '../types/electron';

const isElectron = (): boolean =>
  typeof window !== 'undefined' && 'electronAPI' in window;

// Helper: Download blob as file
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Helper: Escape HTML
function escHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Helper: Extract text from ProseMirror JSON nodes
function pmNodeToHTML(node: any): string {
  if (!node || !node.type) return '';
  switch (node.type) {
    case 'doc':
      return (node.content || []).map(pmNodeToHTML).join('\n');
    case 'heading': {
      const lv = Math.min(node.attrs?.level || 1, 3);
      const text = (node.content || []).map(pmNodeToHTML).join('');
      return `<h${lv}>${text || '&nbsp;'}</h${lv}>`;
    }
    case 'paragraph': {
      const text = (node.content || []).map((n: any) =>
        n.type === 'text' ? (n.marks?.some((m: any) => m.type === 'bold') ? `<strong>${escHtml(n.text||'')}</strong>` : n.marks?.some((m: any) => m.type === 'italic') ? `<em>${escHtml(n.text||'')}</em>` : escHtml(n.text||'')) : ''
      ).join('');
      return text.trim() ? `<p>${text}</p>` : '<p>&nbsp;</p>';
    }
    case 'table': {
      let html = '<table><tbody>';
      (node.content || []).forEach((row: any) => {
        html += '<tr>';
        (row.content || []).forEach((cell: any) => {
          const text = (cell.content || []).map(pmNodeToHTML).join('');
          html += `<td>${text || '&nbsp;'}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      return html;
    }
    case 'image':
      return `<img src="${escHtml(node.attrs?.src || '')}" alt="${escHtml(node.attrs?.alt || '')}" />`;
    case 'text':
      return escHtml(node.text || '');
    default:
      return '';
  }
}

// Helper: Build full export HTML with proper styling
function buildExportHTML(doc: QiuAiDocument, _format: string): string {
  let bodyHTML = '';
  const content = doc.editorContent as any;
  if (content?.content) {
    bodyHTML = content.content.map(pmNodeToHTML).join('\n');
  }
  if (!bodyHTML) {
    bodyHTML = doc.framework.map(n =>
      `<h${n.level}>${escHtml(n.title)}</h${n.level}><p>正文内容待补充</p>`
    ).join('\n');
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>${escHtml(doc.title)}</title>
<style>
@page { size: A4; margin: 25.4mm 31.7mm; }
body {
  font-family: 'FangSong','仿宋','SimSun','宋体',serif;
  font-size: 16pt;
  line-height: 28pt;
  color: #000;
  max-width: 210mm;
  margin: 0 auto;
  padding: 25.4mm 31.7mm;
}
h1 { font-family: 'SimHei','黑体',sans-serif; font-size: 22pt; text-align: center; margin: 24px 0 16px; }
h2 { font-family: 'SimHei','黑体',sans-serif; font-size: 16pt; margin: 20px 0 12px; }
h3 { font-family: 'SimHei','黑体',sans-serif; font-size: 14pt; margin: 16px 0 10px; }
p { text-indent: 2em; margin: 0 0 8px; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; }
table thead { border-top: 1.5pt solid #000; border-bottom: 0.75pt solid #000; }
table tbody { border-bottom: 1.5pt solid #000; }
th, td { padding: 4pt 8pt; text-align: center; font-size: 10.5pt; }
img { max-width: 100%; height: auto; }
@media print { body { padding: 0; } }
</style>
</head>
<body>
<h1 style="text-align:center">${escHtml(doc.title)}</h1>
${bodyHTML}
</body>
</html>`;
}

// Browser-mode mock storage
const STORAGE_KEY = 'qiuai_drafts';

function loadDrafts(): Record<string, QiuAiDocument> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDrafts(drafts: Record<string, QiuAiDocument>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

// Mock text generation (placeholder)
async function* mockGenerateText(sectionTitle: string): AsyncGenerator<string> {
  const placeholder = `${sectionTitle}\n\n基于对相关领域的深入调研和分析，本章节将系统阐述${sectionTitle}相关内容。\n\n本部分内容将在参考材料充分的情况下，由AI模型自动生成高质量的专业文本。实际部署时将接入自然语言模型API进行实时生成，支持Claude、GPT、本地Ollama等多种模型。\n\n（提示：这是浏览器模式的占位文本。在Electron桌面应用中，此内容将由AI模型实时生成。）`;
  const words = placeholder.split('');
  let buffer = '';
  for (const char of words) {
    buffer += char;
    if (buffer.length >= 10) {
      yield buffer;
      buffer = '';
      await new Promise((r) => setTimeout(r, 15));
    }
  }
  if (buffer) yield buffer;
}

// Browser mock implementations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const browserMocks: Record<string, any> = {
  [IPC_CHANNELS.FILE_SAVE_DRAFT]: async (doc: QiuAiDocument) => {
    const drafts = loadDrafts();
    doc.updatedAt = new Date().toISOString();
    drafts[doc.id] = doc;
    saveDrafts(drafts);
    const meta: DraftMeta = {
      id: doc.id,
      title: doc.title,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      currentPhase: doc.currentPhase,
      wordCount: 0,
      pageCount: 0,
    };
    return { success: true, data: meta };
  },

  [IPC_CHANNELS.FILE_OPEN_DRAFT]: async (draftId: string) => {
    const drafts = loadDrafts();
    const doc = drafts[draftId];
    if (!doc) return { success: false, error: '草稿未找到' };
    return { success: true, data: doc };
  },

  [IPC_CHANNELS.FILE_LIST_DRAFTS]: async () => {
    const drafts = loadDrafts();
    const metas: DraftMeta[] = Object.values(drafts)
      .map((d) => ({
        id: d.id,
        title: d.title,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        currentPhase: d.currentPhase,
        wordCount: 0,
        pageCount: 0,
      }))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    return { success: true, data: metas };
  },

  [IPC_CHANNELS.FILE_DELETE_DRAFT]: async (draftId: string) => {
    const drafts = loadDrafts();
    delete drafts[draftId];
    saveDrafts(drafts);
    return { success: true };
  },

  [IPC_CHANNELS.FILE_IMPORT_REFERENCE]: async (fileType: string) => {
    // In browser mode, use file input
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = fileType === 'pdf' ? '.pdf' : '.docx,.doc';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve({ success: true, data: null });
          return;
        }
        const ref: ReferenceMaterial = {
          id: generateId(),
          fileName: file.name,
          filePath: URL.createObjectURL(file),
          fileType: fileType as 'pdf' | 'docx',
          chunks: [
            {
              id: generateId(),
              text: `[浏览器模式：文件 "${file.name}" 已加载，大小 ${(file.size / 1024).toFixed(1)} KB。桌面版将进行全文解析。]`,
              metadata: {},
            },
          ],
        };
        resolve({ success: true, data: ref });
      };
      input.click();
    });
  },

  [IPC_CHANNELS.AI_GENERATE_TEXT]: async (request: { sectionTitle: string }) => {
    const chunks: string[] = [];
    for await (const chunk of mockGenerateText(request.sectionTitle)) {
      chunks.push(chunk);
    }
    return { success: true, data: { content: chunks.join('') } };
  },

  [IPC_CHANNELS.AI_POLISH_TEXT]: async (request: { originalText: string; style: string }) => {
    const polishExamples: Record<string, string> = {
      formal: `【正式公文风格润色】\n${request.originalText}\n\n（桌面版将由AI进行实时润色，支持多种风格选择。）`,
      academic: `【学术论文风格润色】\n${request.originalText}\n\n（桌面版将由AI进行实时润色，支持多种风格选择。）`,
      concise: `【精简版】\n${request.originalText.slice(0, 100)}...\n\n（桌面版将由AI进行实时精简。）`,
      expand: `【扩展版】\n${request.originalText}\n\n（桌面版将由AI进行实时扩展，增加细节和论据。）`,
    };
    return { success: true, data: polishExamples[request.style] || polishExamples.formal };
  },

  [IPC_CHANNELS.AI_GENERATE_IMAGE]: async () => {
    return { success: true, data: { base64: '' } };
  },

  [IPC_CHANNELS.AI_PROCESS_TABLE]: async (request: { csvData: string; headers: string[] }) => {
    const lines = request.csvData.trim().split('\n');
    const rows = lines.slice(1).map((line) => line.split(',').map((c) => c.trim()));
    return { success: true, data: { headers: request.headers, rows } as TableData };
  },

  [IPC_CHANNELS.EXPORT_DOCX]: async (doc: QiuAiDocument) => {
    const html = buildExportHTML(doc, 'docx');
    const blob = new Blob(['﻿' + html], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, `${doc.title || '申报书'}.doc`);
    return { success: true, data: 'browser-download' };
  },

  [IPC_CHANNELS.EXPORT_PDF]: async (doc: QiuAiDocument) => {
    const html = buildExportHTML(doc, 'pdf');
    // Open print dialog for PDF
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
    if (isElectron()) return window.electronAPI;
    return null;
  }

  async invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    const api = this.getAPI();
    if (api) {
      return api.invoke<T>(channel, ...args);
    }
    // Browser fallback
    const mock = browserMocks[channel];
    if (mock) {
      return mock(...args) as Promise<T>;
    }
    console.warn(`[IPC] No mock for channel: ${channel}`);
    return { success: false, error: 'Browser mode: channel not available' } as T;
  }

  on(channel: string, callback: (...args: unknown[]) => void): () => void {
    const api = this.getAPI();
    if (api) return api.on(channel, callback);
    return () => {};
  }
}

export const ipcClient = new IPCClient();

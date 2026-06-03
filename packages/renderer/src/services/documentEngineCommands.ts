import type { JSONContent } from '@tiptap/core';
import {
  IPC_CHANNELS,
  WritingPhase,
  generateId,
  parseOutlineText,
  syncDocumentWithState,
  type AIChatAction,
  type CitationStyleProfile,
  type DraftMeta,
  type ExportRequest,
  type FrameworkNode,
  type IPCResponse,
  type PageBorderSettings,
  type PageLayoutSettings,
  type PageWatermarkSettings,
  type PaperSafetyIssue,
  type PaperSafetyReport,
  type QiuAiDocument,
  type ReferenceSource,
  type ReviewIssue,
} from '@qiuai/shared';
import {
  buildTocEntries,
  createDocumentAnchorId,
  getNextCaptionNumber,
} from '../components/editor/documentReferenceUtils';
import { useDocumentEngineStore } from '../stores/useDocumentEngineStore';
import { useEditorStore } from '../stores/useEditorStore';
import { useFrameworkStore } from '../stores/useFrameworkStore';
import { usePageViewStore } from '../stores/usePageViewStore';
import { usePhaseStore } from '../stores/usePhaseStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { supportsDocumentCommands } from '../utils/documentEngineCapabilities';
import { generateAndApplyFullPaperFromOutline } from './fullPaperGeneration';
import { ipcClient } from './ipcClient';

function normalizeText(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCurrentDocSnapshot(): QiuAiDocument {
  return useProjectStore.getState().doc;
}

function updateCurrentDoc(mutator: (doc: QiuAiDocument) => QiuAiDocument): boolean {
  const currentDoc = getCurrentDocSnapshot();
  const nextDoc = syncDocumentWithState({
    ...mutator(currentDoc),
    updatedAt: new Date().toISOString(),
  });
  useProjectStore.getState().setDoc(nextDoc);
  useFrameworkStore.getState().setNodes(nextDoc.framework || []);
  useEditorStore.getState().setDirty(true);
  return true;
}

function resolveWritingPhase(value: unknown): WritingPhase | null {
  const normalized = String(value || '').trim().toLowerCase();
  const map: Record<string, WritingPhase> = {
    framework: WritingPhase.FRAMEWORK,
    slots: WritingPhase.SLOTS,
    text: WritingPhase.TEXT_GEN,
    text_gen: WritingPhase.TEXT_GEN,
    images: WritingPhase.IMAGES,
    tables: WritingPhase.TABLES,
    done: WritingPhase.DONE,
  };
  return map[normalized] ?? null;
}

function openTaskPaneTab(tab: string): boolean {
  const allowed = ['properties', 'strategy', 'assistant', 'review', 'references'];
  const normalized = allowed.includes(tab) ? tab : 'assistant';
  const fn = (window as Window & { __openTaskPane?: (pane: string) => void }).__openTaskPane;
  if (!fn) {
    return false;
  }
  fn(normalized);
  return true;
}

function computePaperSafetyReport(doc: QiuAiDocument, editorText: string): PaperSafetyReport {
  const issues: PaperSafetyIssue[] = [];
  const { documentState } = doc;
  const hasBodyContent =
    editorText.trim().length > 0 ||
    documentState.pageCount > 1 ||
    documentState.sectionSummaries.length > 0 ||
    doc.framework.length > 0;

  if (hasBodyContent && documentState.citationOccurrences.length === 0) {
    issues.push({
      id: generateId(),
      severity: 'warning',
      category: 'uncited-claim',
      message: '正文已有内容，但还没有任何文中引用记录。',
      relatedSourceIds: [],
      suggestion: '建议先为关键结论、定义和数据补充文中引用。',
    });
  }

  documentState.facts
    .filter((item) => !item.sourceReferenceIds?.length)
    .forEach((item) => {
      issues.push({
        id: generateId(),
        severity: 'warning',
        category: 'data-without-source',
        message: `事实“${item.label}”缺少来源绑定。`,
        relatedSourceIds: [],
        suggestion: '请补充参考来源或核验依据。',
      });
    });

  documentState.referenceSources
    .filter((item) => !item.title || item.authors.length === 0 || (!item.year && !item.issuedDate))
    .forEach((item) => {
      issues.push({
        id: generateId(),
        severity: 'info',
        category: 'incomplete-reference',
        message: `参考条目“${item.title || '未命名条目'}”元数据不完整。`,
        relatedSourceIds: [item.id],
        suggestion: '建议补充作者、年份或来源信息。',
      });
    });

  const citedSourceIds = new Set(documentState.citationOccurrences.flatMap((item) => item.sourceIds));
  documentState.referenceSources
    .filter((item) => !citedSourceIds.has(item.id))
    .forEach((item) => {
      issues.push({
        id: generateId(),
        severity: 'info',
        category: 'unused-reference',
        message: `参考条目“${item.title}”尚未在正文中使用。`,
        relatedSourceIds: [item.id],
        suggestion: '如最终不使用，可移出当前文档参考库。',
      });
    });

  return {
    generatedAt: new Date().toISOString(),
    overallRisk: issues.some((item) => item.severity === 'error')
      ? 'high'
      : issues.some((item) => item.severity === 'warning')
        ? 'medium'
        : 'low',
    citationCoverage: hasBodyContent
      ? Math.min(
          100,
          Math.round((documentState.citationOccurrences.length / Math.max(1, documentState.referenceSources.length || 1)) * 100)
        )
      : 100,
    uncitedClaimCount: issues.filter((item) => item.category === 'uncited-claim').length,
    dataWithoutSourceCount: issues.filter((item) => item.category === 'data-without-source').length,
    figureWithoutSourceCount: 0,
    tableWithoutSourceCount: 0,
    aiAssistedParagraphCount: documentState.aiAuthorshipRecords.length,
    issues,
  };
}

async function exportCurrentDocument(format: 'docx' | 'pdf', suggestedFileName?: string): Promise<boolean> {
  const currentEditor = useEditorStore.getState().editor;
  const pageCount = useEditorStore.getState().pageCount;
  const latestDoc = getCurrentDocSnapshot();
  const normalizedFileName = normalizeText(suggestedFileName || latestDoc.title || '项目报告') || '项目报告';
  const exportDoc = syncDocumentWithState({
    ...latestDoc,
    title: normalizedFileName,
    editorContent: currentEditor?.getJSON() || latestDoc.editorContent,
    documentState: {
      ...latestDoc.documentState,
      pageCount,
    },
    updatedAt: new Date().toISOString(),
  });

  const channel = format === 'pdf' ? IPC_CHANNELS.EXPORT_PDF : IPC_CHANNELS.EXPORT_DOCX;
  const payload: ExportRequest = {
    doc: exportDoc,
    suggestedFileName: `${normalizedFileName}.${format}`,
  };
  const result = await ipcClient.invoke<IPCResponse<string>>(channel, payload);
  return Boolean(result.success);
}

async function executeApplicationCommand(
  command: string,
  payload: Record<string, unknown> = {}
): Promise<boolean | null> {
  switch (command) {
    case 'save-document':
      await saveCurrentDocument();
      return true;
    case 'new-document': {
      useProjectStore.getState().reset();
      useFrameworkStore.getState().reset();
      usePhaseStore.getState().setPhase(WritingPhase.FRAMEWORK);
      usePageViewStore.getState().setEditMode('none');
      usePageViewStore.getState().setActiveVariant('default');

      const title = normalizeText(payload.title) || '未命名文档';
      updateCurrentDoc((doc) => ({
        ...doc,
        title,
      }));
      await replaceDocumentContent('');
      useEditorStore.getState().setDirty(false);

      const freshDoc = syncDocumentWithState(useProjectStore.getState().doc);
      const result = await ipcClient.invoke<IPCResponse>(IPC_CHANNELS.FILE_SAVE_DRAFT, freshDoc);
      return Boolean(result.success);
    }
    case 'set-document-title': {
      const title = normalizeText(payload.title || payload.value);
      if (!title) {
        return false;
      }
      return updateCurrentDoc((doc) => ({
        ...doc,
        title,
      }));
    }
    case 'set-track-revisions': {
      return updateCurrentDoc((doc) => ({
        ...doc,
        documentState: {
          ...doc.documentState,
          trackRevisions: Boolean(payload.enabled ?? payload.value),
        },
      }));
    }
    case 'set-page-layout': {
      const currentLayout = getCurrentDocSnapshot().documentState.pageLayout;
      const nextLayout: PageLayoutSettings = {
        ...currentLayout,
        ...(payload.layout as Partial<PageLayoutSettings> | undefined),
        margins: {
          ...currentLayout.margins,
          ...((payload.margins as Partial<PageLayoutSettings['margins']>) || {}),
        },
        columns: {
          ...currentLayout.columns,
          ...((payload.columns as Partial<PageLayoutSettings['columns']>) || {}),
        },
        watermark: {
          ...currentLayout.watermark,
          ...((payload.watermark as Partial<PageWatermarkSettings>) || {}),
        },
        pageBorder: {
          ...currentLayout.pageBorder,
          ...((payload.pageBorder as Partial<PageBorderSettings>) || {}),
        },
      };

      return updateCurrentDoc((doc) => ({
        ...doc,
        documentState: {
          ...doc.documentState,
          pageLayout: nextLayout,
        },
      }));
    }
    case 'set-page-margins': {
      return updateCurrentDoc((doc) => ({
        ...doc,
        documentState: {
          ...doc.documentState,
          pageLayout: {
            ...doc.documentState.pageLayout,
            preset: 'custom',
            margins: {
              top: Number(payload.top ?? doc.documentState.pageLayout.margins.top),
              bottom: Number(payload.bottom ?? doc.documentState.pageLayout.margins.bottom),
              left: Number(payload.left ?? doc.documentState.pageLayout.margins.left),
              right: Number(payload.right ?? doc.documentState.pageLayout.margins.right),
            },
          },
        },
      }));
    }
    case 'set-page-orientation': {
      const orientation = payload.value === 'landscape' ? 'landscape' : 'portrait';
      return updateCurrentDoc((doc) => ({
        ...doc,
        documentState: {
          ...doc.documentState,
          pageLayout: {
            ...doc.documentState.pageLayout,
            orientation,
          },
        },
      }));
    }
    case 'set-columns': {
      const count = Math.max(1, Math.min(3, Number(payload.count ?? 1))) as 1 | 2 | 3;
      return updateCurrentDoc((doc) => ({
        ...doc,
        documentState: {
          ...doc.documentState,
          pageLayout: {
            ...doc.documentState.pageLayout,
            columns: {
              count,
              gap: count === 1 ? 12 : Number(payload.gap ?? doc.documentState.pageLayout.columns.gap),
              separator: count === 1 ? false : Boolean(payload.separator),
            },
          },
        },
      }));
    }
    case 'set-watermark': {
      return updateCurrentDoc((doc) => ({
        ...doc,
        documentState: {
          ...doc.documentState,
          pageLayout: {
            ...doc.documentState.pageLayout,
            watermark: {
              ...doc.documentState.pageLayout.watermark,
              enabled: true,
              text: normalizeText(payload.text) || doc.documentState.pageLayout.watermark.text,
              color: normalizeText(payload.color) || doc.documentState.pageLayout.watermark.color,
              opacity:
                typeof payload.opacity === 'number'
                  ? Number(payload.opacity)
                  : doc.documentState.pageLayout.watermark.opacity,
              rotation:
                typeof payload.rotation === 'number'
                  ? Number(payload.rotation)
                  : doc.documentState.pageLayout.watermark.rotation,
            },
          },
        },
      }));
    }
    case 'clear-watermark': {
      return updateCurrentDoc((doc) => ({
        ...doc,
        documentState: {
          ...doc.documentState,
          pageLayout: {
            ...doc.documentState.pageLayout,
            watermark: {
              ...doc.documentState.pageLayout.watermark,
              enabled: false,
            },
          },
        },
      }));
    }
    case 'set-page-border': {
      return updateCurrentDoc((doc) => ({
        ...doc,
        documentState: {
          ...doc.documentState,
          pageLayout: {
            ...doc.documentState.pageLayout,
            pageBorder: {
              ...doc.documentState.pageLayout.pageBorder,
              mode: (payload.mode as PageBorderSettings['mode']) || doc.documentState.pageLayout.pageBorder.mode,
              color: normalizeText(payload.color) || doc.documentState.pageLayout.pageBorder.color,
              width:
                typeof payload.width === 'number'
                  ? Number(payload.width)
                  : doc.documentState.pageLayout.pageBorder.width,
              lineStyle:
                (payload.lineStyle as PageBorderSettings['lineStyle']) ||
                doc.documentState.pageLayout.pageBorder.lineStyle,
            },
          },
        },
      }));
    }
    case 'set-header-footer': {
      const mode = payload.mode === 'footer' ? 'footer' : 'header';
      const variant =
        payload.variant === 'first' || payload.variant === 'odd' || payload.variant === 'even'
          ? payload.variant
          : 'default';
      const fieldMap = {
        header: {
          default: 'headerText',
          first: 'firstPageHeaderText',
          odd: 'oddHeaderText',
          even: 'evenHeaderText',
        },
        footer: {
          default: 'footerText',
          first: 'firstPageFooterText',
          odd: 'oddFooterText',
          even: 'evenFooterText',
        },
      } as const;
      const field = fieldMap[mode][variant];
      const text = String(payload.text || '');

      return updateCurrentDoc((doc) => ({
        ...doc,
        documentState: {
          ...doc.documentState,
          pageLayout: {
            ...doc.documentState.pageLayout,
            [field]: text,
            differentFirstPage:
              variant === 'first' ? true : doc.documentState.pageLayout.differentFirstPage,
            differentOddEven:
              variant === 'odd' || variant === 'even'
                ? true
                : doc.documentState.pageLayout.differentOddEven,
          },
        },
      }));
    }
    case 'enter-header-edit':
      usePageViewStore.getState().setEditMode('header');
      return true;
    case 'enter-footer-edit':
      usePageViewStore.getState().setEditMode('footer');
      return true;
    case 'exit-header-footer-edit':
      usePageViewStore.getState().setEditMode('none');
      return true;
    case 'set-page-variant': {
      const variant =
        payload.value === 'first' || payload.value === 'odd' || payload.value === 'even'
          ? payload.value
          : 'default';
      usePageViewStore.getState().setActiveVariant(variant);
      return true;
    }
    case 'export-docx':
      return exportCurrentDocument('docx', typeof payload.fileName === 'string' ? payload.fileName : undefined);
    case 'export-pdf':
      return exportCurrentDocument('pdf', typeof payload.fileName === 'string' ? payload.fileName : undefined);
    case 'generate-full-paper': {
      const aiConfig = useSettingsStore.getState().getWritingConfig();
      const referenceMaterials =
        Array.isArray(payload.referenceMaterials) && payload.referenceMaterials.length > 0
          ? (payload.referenceMaterials as QiuAiDocument['referenceMaterials'])
          : undefined;
      const dataKeywords =
        Array.isArray(payload.dataKeywords) && payload.dataKeywords.length > 0
          ? payload.dataKeywords.map((item) => String(item))
          : useSettingsStore.getState().settings.dataKeywords;

      await generateAndApplyFullPaperFromOutline({
        aiConfig,
        referenceMaterials,
        dataKeywords,
      });
      return true;
    }
    default:
      return null;
  }
}

export async function saveCurrentDocument(): Promise<void> {
  const adapter = useDocumentEngineStore.getState().adapter;
  if (adapter) {
    await adapter.saveDocument();
    useEditorStore.getState().setDirty(false);
    return;
  }

  const currentDoc = useProjectStore.getState().doc;
  const editor = useEditorStore.getState().editor;
  const pageCount = useEditorStore.getState().pageCount;
  const docToSave = syncDocumentWithState({
    ...currentDoc,
    editorContent: editor?.getJSON() || currentDoc.editorContent,
    documentState: {
      ...currentDoc.documentState,
      pageCount,
    },
    updatedAt: new Date().toISOString(),
  });

  const result = await ipcClient.invoke<IPCResponse>(IPC_CHANNELS.FILE_SAVE_DRAFT, docToSave);
  if (!result.success) {
    throw new Error(result.error || '保存失败');
  }

  useEditorStore.getState().setDirty(false);
}

export async function executeDocumentCommand(
  command: string,
  payload: Record<string, unknown> = {}
): Promise<boolean> {
  const applicationResult = await executeApplicationCommand(command, payload);
  if (applicationResult !== null) {
    return applicationResult;
  }

  const adapter = useDocumentEngineStore.getState().adapter;
  if (adapter && supportsDocumentCommands(adapter) && adapter.executeCommand) {
    return adapter.executeCommand(command, payload);
  }

  const editor = useEditorStore.getState().editor;
  if (!editor) {
    return false;
  }

  switch (command) {
    case 'undo':
      return editor.chain().focus().undo().run();
    case 'redo':
      return editor.chain().focus().redo().run();
    case 'set-align':
      return editor
        .chain()
        .focus()
        .setTextAlign(String(payload.value || 'left') as 'left' | 'center' | 'right' | 'justify')
        .run();
    case 'toggle-bold':
      return editor.chain().focus().toggleBold().run();
    case 'toggle-italic':
      return editor.chain().focus().toggleItalic().run();
    case 'toggle-underline':
      return editor.chain().focus().toggleUnderline().run();
    case 'toggle-bullet-list':
      return editor.chain().focus().toggleBulletList().run();
    case 'toggle-ordered-list':
      return editor.chain().focus().toggleOrderedList().run();
    case 'set-font-family':
      return editor.chain().focus().setMark('textStyle', { fontFamily: payload.value }).run();
    case 'set-font-size':
      return editor.chain().focus().setMark('textStyle', { fontSize: payload.value }).run();
    case 'set-text-color':
      return editor.chain().focus().setMark('textStyle', { color: payload.value }).run();
    case 'set-line-height':
      return editor
        .chain()
        .focus()
        .setParagraphAttrs({ lineHeight: String(payload.value || '1.5') })
        .run();
    case 'set-space-before':
      return editor
        .chain()
        .focus()
        .setParagraphAttrs({ spaceBefore: String(payload.value || '0pt') })
        .run();
    case 'set-space-after':
      return editor
        .chain()
        .focus()
        .setParagraphAttrs({ spaceAfter: String(payload.value || '8px') })
        .run();
    case 'set-text-indent':
      return editor
        .chain()
        .focus()
        .setParagraphAttrs({
          textIndent: payload.value === '0em' ? null : String(payload.value || '2em'),
        })
        .run();
    case 'set-margin-left':
      return editor
        .chain()
        .focus()
        .setParagraphAttrs({ marginLeft: String(payload.value || '0pt') })
        .run();
    case 'set-margin-right':
      return editor
        .chain()
        .focus()
        .setParagraphAttrs({ marginRight: String(payload.value || '0pt') })
        .run();
    case 'apply-style':
      return editor
        .chain()
        .focus()
        .command(({ commands }) => {
          return (
            (commands as { applyStyle?: (styleName: string) => boolean }).applyStyle?.(
              String(payload.value || 'Normal')
            ) ?? false
          );
        })
        .run();
    case 'clear-formatting':
      editor.chain().focus().unsetAllMarks().run();
      return editor
        .chain()
        .focus()
        .setParagraphAttrs({
          lineHeight: null,
          textIndent: '2em',
          marginLeft: null,
          marginRight: null,
          spaceBefore: null,
          spaceAfter: '8px',
          textAlign: null,
        })
        .run();
    case 'insert-html':
      return editor.chain().focus().insertContent(String(payload.html || payload.value || '')).run();
    case 'insert-text':
      return editor.chain().focus().insertContent(String(payload.text || payload.value || '')).run();
    case 'set-link': {
      const href = normalizeText(payload.href || payload.value);
      const text = normalizeText(payload.text || payload.label || href) || href;
      if (!href) {
        return false;
      }

      if (editor.state.selection.empty) {
        return editor
          .chain()
          .focus()
          .insertContent({
            type: 'text',
            text,
            marks: [{ type: 'link', attrs: { href, class: 'editor-link' } }],
          })
          .run();
      }

      return editor.chain().focus().setLink({ href }).run();
    }
    case 'insert-link-text': {
      const href = normalizeText(payload.href || payload.value);
      const text = normalizeText(payload.text || payload.label || href) || href;
      if (!href || !text) {
        return false;
      }

      return editor
        .chain()
        .focus()
        .deleteSelection()
        .insertContent({
          type: 'text',
          text,
          marks: [{ type: 'link', attrs: { href, class: 'editor-link' } }],
        })
        .run();
    }
    case 'remove-link':
      return editor.chain().focus().unsetLink().run();
    case 'insert-table':
      return editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run();
    case 'insert-table-placeholder': {
      const selectionPos = editor.state.selection.from;
      const tableNumber = String(
        payload.tableNumber || getNextCaptionNumber(editor.state.doc, 'table', selectionPos)
      );
      const caption = String(payload.caption || '表格标题');
      const sectionId = String(payload.sectionId || '');
      const tableIndex = Number(payload.tableIndex || 0);
      const headers =
        Array.isArray(payload.headers) && payload.headers.length > 0
          ? payload.headers.map((item) => String(item))
          : ['列 1', '列 2', '列 3'];
      const rows =
        Array.isArray(payload.rows) && payload.rows.length > 0
          ? payload.rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell)) : ['', '', '']))
          : [
              ['', '', ''],
              ['', '', ''],
              ['', '', ''],
            ];

      return editor
        .chain()
        .focus()
        .command(({ commands }) => {
          return (
            (commands as {
              insertTablePlaceholder?: (attrs: {
                tableNumber: string;
                caption: string;
                sectionId: string;
                tableIndex: number;
                headers?: string[];
                rows?: string[][];
              }) => boolean;
            }).insertTablePlaceholder?.({
              tableNumber,
              caption,
              sectionId,
              tableIndex,
              headers,
              rows,
            }) ?? false
          );
        })
        .insertContent({
          type: 'paragraph',
          attrs: {
            class: 'table-text',
            styleName: 'TableCaption',
            textAlign: 'center',
            textIndent: null,
            spaceBefore: '4px',
            spaceAfter: '16px',
          },
          content: [{ type: 'text', text: `表 ${tableNumber} ${caption}` }],
        })
        .run();
    }
    case 'insert-image-placeholder': {
      const selectionPos = editor.state.selection.from;
      const figureNumber = String(
        payload.figureNumber || getNextCaptionNumber(editor.state.doc, 'image', selectionPos)
      );
      const caption = String(payload.caption || '图片标题');
      const sectionId = String(payload.sectionId || '');
      const imageIndex = Number(payload.imageIndex || 0);
      const imageData =
        typeof payload.imageData === 'string' && payload.imageData.trim().length > 0
          ? payload.imageData
          : null;

      return editor
        .chain()
        .focus()
        .command(({ commands }) => {
          return (
            (commands as {
              insertImagePlaceholder?: (attrs: {
                figureNumber: string;
                caption: string;
                sectionId: string;
                imageIndex: number;
                imageData?: string | null;
              }) => boolean;
            }).insertImagePlaceholder?.({
              figureNumber,
              caption,
              sectionId,
              imageIndex,
              imageData,
            }) ?? false
          );
        })
        .insertContent({
          type: 'paragraph',
          attrs: {
            class: 'image-text',
            styleName: 'Caption',
            textAlign: 'center',
            textIndent: null,
            spaceBefore: '4px',
            spaceAfter: '16px',
          },
          content: [{ type: 'text', text: `图 ${figureNumber} ${caption}` }],
        })
        .run();
    }
    case 'insert-page-break':
      return editor
        .chain()
        .focus()
        .insertContent([
          {
            type: 'paragraph',
            attrs: {
              class: 'page-break',
              styleName: 'PageBreak',
              textAlign: 'center',
              textIndent: null,
              lineHeight: '1',
              spaceBefore: '0',
              spaceAfter: '0',
            },
          },
          {
            type: 'paragraph',
            attrs: {
              class: 'body-text',
              styleName: 'Normal',
            },
          },
        ])
        .run();
    case 'insert-page-number-field':
      return editor
        .chain()
        .focus()
        .insertContent({
          type: 'paragraph',
          attrs: {
            class: 'page-number-field',
            styleName: 'PageNumber',
            textAlign: 'center',
            textIndent: null,
            spaceBefore: '4px',
            spaceAfter: '8px',
          },
          content: [{ type: 'text', text: '第 [页码] 页' }],
        })
        .run();
    case 'insert-equation-block':
      return editor
        .chain()
        .focus()
        .insertContent({
          type: 'paragraph',
          attrs: {
            class: 'math-block',
            styleName: 'Equation',
            textAlign: 'center',
            textIndent: null,
            spaceBefore: '12px',
            spaceAfter: '12px',
          },
          content: [{ type: 'text', text: String(payload.text || '公式：') }],
        })
        .run();
    case 'insert-auxiliary-block': {
      const kind = String(payload.kind || 'textBox');
      const title = String(
        payload.title || (kind === 'shape' ? '形状' : kind === 'chart' ? '图表' : '文本框')
      );
      const body = String(payload.body || '');
      return editor
        .chain()
        .focus()
        .insertContent({
          type: 'auxiliaryBlock',
          attrs: { kind, title, body },
        })
        .run();
    }
    case 'insert-toc': {
      const title = String(payload.title || '目录');
      const levels = Array.isArray(payload.levels) ? (payload.levels as number[]) : [1, 2, 3];
      const withPageNumbers = Boolean(payload.withPageNumbers);
      const entries = buildTocEntries(editor.state.doc, {
        title,
        levels,
        withPageNumbers,
      });

      if (entries.length === 0) {
        return false;
      }

      return editor
        .chain()
        .focus()
        .insertContent({
          type: 'tocBlock',
          attrs: {
            title,
            withPageNumbers,
            entries,
          },
        })
        .run();
    }
    case 'scroll-to-heading': {
      const rawTitle = normalizeText(payload.value || payload.title);
      if (!rawTitle) {
        return false;
      }

      const targetAnchorId = createDocumentAnchorId('heading', rawTitle);
      let targetPos: number | null = null;

      editor.state.doc.descendants((node, pos) => {
        if (targetPos !== null) {
          return false;
        }

        if (node.type.name === 'heading' && normalizeText(node.textContent) === rawTitle) {
          targetPos = pos;
          return false;
        }

        const attrs = (node.attrs ?? {}) as Record<string, unknown>;
        const anchorId = normalizeText(attrs.id || attrs['data-anchor-id']);
        if (anchorId && anchorId === targetAnchorId) {
          targetPos = pos;
          return false;
        }

        return undefined;
      });

      if (targetPos === null) {
        return false;
      }

      editor.chain().focus().setTextSelection(targetPos).run();
      editor.commands.scrollIntoView();
      return true;
    }
    default:
      return false;
  }
}

export async function insertDocumentText(text: string): Promise<boolean> {
  return executeDocumentCommand('insert-text', { text });
}

export async function insertDocumentDateTime(text: string): Promise<boolean> {
  return executeDocumentCommand('insert-text', { text });
}

export async function insertDocumentHtml(html: string): Promise<boolean> {
  return executeDocumentCommand('insert-html', { html });
}

export async function insertDocumentTable(): Promise<boolean> {
  return executeDocumentCommand('insert-table');
}

export async function insertDocumentTablePlaceholder(payload: {
  caption?: string;
  tableNumber?: string;
  sectionId?: string;
  tableIndex?: number;
  headers?: string[];
  rows?: string[][];
}): Promise<boolean> {
  return executeDocumentCommand('insert-table-placeholder', payload);
}

export async function insertDocumentImagePlaceholder(payload: {
  caption?: string;
  figureNumber?: string;
  sectionId?: string;
  imageIndex?: number;
  imageData?: string | null;
}): Promise<boolean> {
  return executeDocumentCommand('insert-image-placeholder', payload);
}

export async function insertDocumentPageBreak(): Promise<boolean> {
  return executeDocumentCommand('insert-page-break');
}

export async function insertDocumentPageNumberField(): Promise<boolean> {
  return executeDocumentCommand('insert-page-number-field');
}

export async function insertDocumentEquationBlock(text = '公式：'): Promise<boolean> {
  return executeDocumentCommand('insert-equation-block', { text });
}

export async function insertDocumentAuxiliaryBlock(payload: {
  kind: 'textBox' | 'shape' | 'chart';
  title?: string;
  body?: string;
}): Promise<boolean> {
  return executeDocumentCommand('insert-auxiliary-block', payload);
}

export async function insertDocumentLinkText(payload: {
  href: string;
  text: string;
  label?: string;
}): Promise<boolean> {
  return executeDocumentCommand('insert-link-text', payload);
}

export async function replaceDocumentContent(
  content: string | Record<string, unknown> | JSONContent
): Promise<boolean> {
  const adapter = useDocumentEngineStore.getState().adapter;
  if (adapter && supportsDocumentCommands(adapter) && adapter.executeCommand) {
    return adapter.executeCommand('replace-document-content', { content });
  }

  const editor = useEditorStore.getState().editor;
  if (!editor) {
    return false;
  }

  editor.commands.setContent(content as Parameters<typeof editor.commands.setContent>[0]);
  return true;
}

export async function replaceCurrentSelection(text: string): Promise<boolean> {
  const adapter = useDocumentEngineStore.getState().adapter;
  if (adapter) {
    const result = await adapter.replaceSelection(text);
    return result.applied;
  }

  const editor = useEditorStore.getState().editor;
  if (!editor) {
    return false;
  }

  return editor.chain().focus().deleteSelection().insertContent(text).run();
}

export async function appendTextAfterCurrentSelection(text: string): Promise<boolean> {
  const adapter = useDocumentEngineStore.getState().adapter;
  if (adapter) {
    const selection = await adapter.getSelection();
    const result = await adapter.replaceSelection(`${selection.selectedText || ''}${text}`);
    return result.applied;
  }

  const editor = useEditorStore.getState().editor;
  if (!editor) {
    return false;
  }

  const { to } = editor.state.selection;
  return editor.chain().focus().setTextSelection(to).insertContent(text).run();
}

export async function getCurrentSelectedText(): Promise<string> {
  const adapter = useDocumentEngineStore.getState().adapter;
  if (adapter) {
    const selection = await adapter.getSelection();
    return selection.selectedText || '';
  }

  const editor = useEditorStore.getState().editor;
  if (!editor) {
    return '';
  }

  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, ' ');
}

export async function getCurrentDocumentText(): Promise<string> {
  const editor = useEditorStore.getState().editor;
  if (!editor) {
    return '';
  }

  return editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n');
}

export async function executeAgentAction(action: AIChatAction): Promise<boolean> {
  switch (action.type) {
    case 'replace-selection':
      return replaceCurrentSelection(action.text);
    case 'append-after-selection':
      return appendTextAfterCurrentSelection(action.text);
    case 'insert-text':
      return insertDocumentText(action.text);
    case 'replace-document':
      return replaceDocumentContent(action.text);
    case 'execute-command':
      return executeDocumentCommand(action.command, action.payload || {});
    default:
      return false;
  }
}

export async function executeAgentActions(actions: AIChatAction[]): Promise<{
  appliedCount: number;
  failedCount: number;
}> {
  let appliedCount = 0;
  let failedCount = 0;

  for (const action of actions) {
    const applied = await executeAgentAction(action);
    if (applied) {
      appliedCount += 1;
    } else {
      failedCount += 1;
    }
  }

  return { appliedCount, failedCount };
}

import { EditorContent, useEditor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Highlight from '@tiptap/extension-highlight';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Strike from '@tiptap/extension-strike';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { TextSelection } from 'prosemirror-state';
import {
  IPC_CHANNELS,
  countWords,
  generateId,
  hasMeaningfulEditorContent,
  syncDocumentWithState,
  type FrameworkNode,
  type IPCResponse,
  type PageLayoutSettings,
} from '@qiuai/shared';
import {
  DEFAULT_SELECTION_FORMATTING,
  useEditorStore,
  type SelectionFormattingState,
} from '../../stores/useEditorStore';
import { useDocumentEngineStore } from '../../stores/useDocumentEngineStore';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { normalizeStyleLabel as normalizeDisplayStyleLabel } from '../../utils/displayText';
import { formatPainter } from '../../services/formatPainter';
import { ipcClient } from '../../services/ipcClient';
import {
  captureLayoutSnapshot,
  getPageMetrics,
  syncBlockNodeMetadata,
  type LayoutBreak,
  type LayoutComputationResult,
} from './layoutCore';
import { computeDocumentLayout } from './documentLayoutEngine';
import { PageHeaderFooterLayer } from './PageHeaderFooterLayer';
import { CustomParagraph } from './extensions/CustomParagraph';
import { ImagePlaceholder } from './extensions/ImagePlaceholder';
import { PageFlowBreaks, setPageFlowBreaks, type PageFlowBreakSpec } from './extensions/PageFlowBreaks';
import { ParagraphBorders } from './extensions/ParagraphBorders';
import { RevisionMark } from './extensions/RevisionMark';
import { AuxiliaryBlock } from './extensions/AuxiliaryBlock';
import { TablePlaceholder } from './extensions/TablePlaceholder';
import { TocBlock } from './extensions/TocBlock';
import { createDocumentAnchorId } from './documentReferenceUtils';
import { WordLists } from './extensions/WordLists';
import { WordStyles } from './extensions/WordStyles';

const MM_TO_PX = 96 / 25.4;

function getSectionPath(nodeId: string, nodes: FrameworkNode[], parentPath = ''): string {
  for (const node of nodes) {
    const path = parentPath ? `${parentPath}.${node.order}` : String(node.order);
    if (node.id === nodeId) return path;
    const found = getSectionPath(nodeId, node.children, path);
    if (found) return found;
  }
  return '';
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateStructuredContent(
  node: FrameworkNode,
  allNodes: FrameworkNode[],
  imageCounter: { count: number },
  tableCounter: { count: number }
): string {
  const sectionPath = getSectionPath(node.id, allNodes);
  const level = Math.min(node.level, 3);
  let html = `<h${level}>${esc(node.title)}</h${level}>`;
  html += `<p class="subtitle-text" data-placeholder="小标题说明">在此输入 ${esc(node.title)} 的简要说明...</p>`;

  if (node.needsImage) {
    imageCounter.count += 1;
    html += `<div data-type="image-placeholder" class="image-placeholder-node" contenteditable="false"><div class="image-placeholder-box"><div class="image-placeholder-icon">🖼</div><div class="image-placeholder-hint">双击或拖放图片到此处</div></div><div class="image-placeholder-caption" contenteditable="true">图 ${sectionPath}.${imageCounter.count} 图片标题</div></div>`;
    html += `<p class="image-text" data-placeholder="图片说明">上图展示了 ${esc(node.title)} 的相关内容。</p>`;
  }

  if (node.needsTable) {
    tableCounter.count += 1;
    html += `<div data-type="table-placeholder" class="table-placeholder-node" contenteditable="false"><table class="three-line-placeholder-table"><thead><tr><th>列 1</th><th>列 2</th><th>列 3</th></tr></thead><tbody><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><div class="table-placeholder-caption" contenteditable="true">表 ${sectionPath}.${tableCounter.count} 表格标题</div></div>`;
    html += `<p class="table-text" data-placeholder="表格说明">上表列出了 ${esc(node.title)} 的相关数据。</p>`;
  }

  html += `<p class="body-text" data-placeholder="正文内容">此处输入“${esc(node.title)}”的正文内容。</p>`;

  for (const child of node.children) {
    html += generateStructuredContent(child, allNodes, imageCounter, tableCounter);
  }

  return html;
}

function flattenFrameworkNodes(nodes: FrameworkNode[]): FrameworkNode[] {
  const result: FrameworkNode[] = [];
  for (const node of nodes) {
    result.push(node);
    result.push(...flattenFrameworkNodes(node.children));
  }
  return result;
}

function createFrameworkContentSignature(nodes: FrameworkNode[]): string {
  return JSON.stringify(
    nodes.map((node) => ({
      id: node.id,
      title: node.title,
      level: node.level,
      order: node.order,
      needsImage: node.needsImage,
      needsTable: node.needsTable,
      children: JSON.parse(createFrameworkContentSignature(node.children)),
    }))
  );
}

function normalizeFontFamily(fontFamily: unknown): string {
  if (typeof fontFamily !== 'string' || !fontFamily.trim()) {
    return DEFAULT_SELECTION_FORMATTING.fontFamily;
  }
  return fontFamily.split(',')[0].trim();
}

function resolveStyleLabel(editor: ReturnType<typeof useEditor>): string {
  if (!editor) return DEFAULT_SELECTION_FORMATTING.styleLabel;
  if (editor.isActive('heading', { level: 1 })) return '标题 1';
  if (editor.isActive('heading', { level: 2 })) return '标题 2';
  if (editor.isActive('heading', { level: 3 })) return '标题 3';

  const paragraphAttrs = editor.getAttributes('paragraph') as Record<string, unknown>;
  const styleName = typeof paragraphAttrs.styleName === 'string' ? paragraphAttrs.styleName : '';
  const className = typeof paragraphAttrs.class === 'string' ? paragraphAttrs.class : '';

  if (styleName === 'Caption' || className === 'image-text') return '图注';
  if (styleName === 'TableCaption' || className === 'table-text') return '表注';
  if (styleName === 'Quote' || className === 'quote-text') return '引用';
  if (className === 'subtitle-text') return '副标题';

  return normalizeDisplayStyleLabel(styleName || className || DEFAULT_SELECTION_FORMATTING.styleLabel);
}

function readFormattingState(editor: NonNullable<ReturnType<typeof useEditor>>): SelectionFormattingState {
  const textStyleAttrs = editor.getAttributes('textStyle') as Record<string, unknown>;
  const highlightAttrs = editor.getAttributes('highlight') as Record<string, unknown>;
  const paragraphAttrs = editor.getAttributes('paragraph') as Record<string, unknown>;
  const textAlign = paragraphAttrs.textAlign;
  const activeObject =
    editor.isActive('image') || editor.isActive('imagePlaceholder')
      ? 'image'
      : editor.isActive('table') || editor.isActive('tablePlaceholder')
      ? 'table'
      : 'text';
  const activeRevisionKind = editor.isActive('revisionMark', { revisionKind: 'delete' })
    ? 'delete'
    : editor.isActive('revisionMark', { revisionKind: 'insert' })
    ? 'insert'
    : null;

  return {
    fontFamily: normalizeFontFamily(textStyleAttrs.fontFamily),
    fontSize:
      typeof textStyleAttrs.fontSize === 'string' && textStyleAttrs.fontSize.trim()
        ? textStyleAttrs.fontSize
        : DEFAULT_SELECTION_FORMATTING.fontSize,
    color:
      typeof textStyleAttrs.color === 'string' && textStyleAttrs.color.trim()
        ? textStyleAttrs.color
        : DEFAULT_SELECTION_FORMATTING.color,
    highlightColor:
      typeof highlightAttrs.color === 'string' && highlightAttrs.color.trim()
        ? highlightAttrs.color
        : null,
    isBold: editor.isActive('bold'),
    isItalic: editor.isActive('italic'),
    isUnderline: editor.isActive('underline'),
    isStrike: editor.isActive('strike'),
    isSuperscript: editor.isActive('superscript'),
    isSubscript: editor.isActive('subscript'),
    textAlign:
      textAlign === 'center' || textAlign === 'right' || textAlign === 'justify'
        ? textAlign
        : 'left',
    lineHeight:
      typeof paragraphAttrs.lineHeight === 'string' && paragraphAttrs.lineHeight.trim()
        ? paragraphAttrs.lineHeight
        : DEFAULT_SELECTION_FORMATTING.lineHeight,
    spaceBefore:
      typeof paragraphAttrs.spaceBefore === 'string' && paragraphAttrs.spaceBefore.trim()
        ? paragraphAttrs.spaceBefore
        : DEFAULT_SELECTION_FORMATTING.spaceBefore,
    spaceAfter:
      typeof paragraphAttrs.spaceAfter === 'string' && paragraphAttrs.spaceAfter.trim()
        ? paragraphAttrs.spaceAfter
        : DEFAULT_SELECTION_FORMATTING.spaceAfter,
    textIndent:
      typeof paragraphAttrs.textIndent === 'string' && paragraphAttrs.textIndent.trim()
        ? paragraphAttrs.textIndent
        : DEFAULT_SELECTION_FORMATTING.textIndent,
    marginLeft:
      typeof paragraphAttrs.marginLeft === 'string' && paragraphAttrs.marginLeft.trim()
        ? paragraphAttrs.marginLeft
        : DEFAULT_SELECTION_FORMATTING.marginLeft,
    marginRight:
      typeof paragraphAttrs.marginRight === 'string' && paragraphAttrs.marginRight.trim()
        ? paragraphAttrs.marginRight
        : DEFAULT_SELECTION_FORMATTING.marginRight,
    styleLabel: resolveStyleLabel(editor),
    isBulletList: editor.isActive('bulletList'),
    isOrderedList: editor.isActive('orderedList'),
    activeObject,
    activeRevisionKind,
  };
}


interface EditorContainerProps {
  zoom?: number;
}

interface PageBodyMaskRect {
  key: string;
  topMm: number;
  leftMm: number;
  widthMm: number;
  heightMm: number;
}

function areBreaksEqual(left: PageFlowBreakSpec[], right: PageFlowBreakSpec[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const other = right[index];
    return (
      item.pos === other?.pos &&
      (item.kind ?? 'block') === (other?.kind ?? 'block') &&
      Math.round(item.height) === Math.round(other?.height ?? Number.NaN)
    );
  });
}

function hasLoadedContent(content: Record<string, unknown> | null | undefined) {
  return hasMeaningfulEditorContent(content);
}

export function EditorContainer({ zoom = 1 }: EditorContainerProps) {
  const setEditor = useEditorStore((state) => state.setEditor);
  const setEngineAdapter = useDocumentEngineStore((state) => state.setAdapter);
  const setWordCount = useEditorStore((state) => state.setWordCount);
  const setPageCount = useEditorStore((state) => state.setPageCount);
  const setCurrentPage = useEditorStore((state) => state.setCurrentPage);
  const setDirty = useEditorStore((state) => state.setDirty);
  const setSelectedText = useEditorStore((state) => state.setSelectedText);
  const setActiveSection = useEditorStore((state) => state.setActiveSection);
  const setFormatting = useEditorStore((state) => state.setFormatting);
  const bumpRevisionRefreshKey = useEditorStore((state) => state.bumpRevisionRefreshKey);
  const pageCount = useEditorStore((state) => state.pageCount);
  const currentPage = useEditorStore((state) => state.currentPage);
  const frameworkNodes = useFrameworkStore((state) => state.nodes);
  const pageLayout = useProjectStore((state) => state.doc.documentState.pageLayout);
  const trackRevisions = useProjectStore((state) => state.doc.documentState.trackRevisions);
  const currentDocId = useProjectStore((state) => state.doc.id);
  const currentDocContent = useProjectStore((state) => state.doc.editorContent);

  const prevFrameworkRef = useRef('');
  const frameworkNodesRef = useRef<FrameworkNode[]>(frameworkNodes);
  const loadedDocIdRef = useRef<string | null>(null);
  const frameworkContentAppliedRef = useRef<string>('');
  const pageCountFrameRef = useRef<number | null>(null);
  const contentHostRef = useRef<HTMLDivElement | null>(null);
  const appliedBreaksRef = useRef<PageFlowBreakSpec[]>([]);
  const paginationInFlightRef = useRef(false);
  const lastLayoutSignatureRef = useRef('');
  useEffect(() => {
    frameworkNodesRef.current = frameworkNodes;
  }, [frameworkNodes]);

  useEffect(() => {
    document.documentElement.style.setProperty('--page-margin-top', `${pageLayout.margins.top}mm`);
    document.documentElement.style.setProperty('--page-margin-bottom', `${pageLayout.margins.bottom}mm`);
    document.documentElement.style.setProperty('--page-margin-left', `${pageLayout.margins.left}mm`);
    document.documentElement.style.setProperty('--page-margin-right', `${pageLayout.margins.right}mm`);
    document.documentElement.style.setProperty('--page-orientation', pageLayout.orientation);
    document.documentElement.style.setProperty('--editor-columns', String(pageLayout.columns.count));
    document.documentElement.style.setProperty('--editor-column-gap', `${pageLayout.columns.gap}mm`);
    document.documentElement.style.setProperty(
      '--editor-column-rule',
      pageLayout.columns.separator ? '1px solid #d9d9d9' : 'none'
    );
    document.documentElement.style.setProperty(
      '--watermark-display',
      pageLayout.watermark.enabled ? 'block' : 'none'
    );
    document.documentElement.style.setProperty('--watermark-text', `"${pageLayout.watermark.text}"`);
    document.documentElement.style.setProperty('--watermark-color', pageLayout.watermark.color);
    document.documentElement.style.setProperty('--watermark-opacity', String(pageLayout.watermark.opacity));
    document.documentElement.style.setProperty('--watermark-rotation', `${pageLayout.watermark.rotation}deg`);
  }, [pageLayout]);

  const pageMetrics = getPageMetrics(pageLayout, zoom);
  const page = { width: pageMetrics.pageWidthMm, height: pageMetrics.pageHeightMm };
  const pageBorder =
    pageLayout.pageBorder.mode === 'box'
      ? `${pageLayout.pageBorder.width}pt ${pageLayout.pageBorder.lineStyle} ${pageLayout.pageBorder.color}`
      : 'none';
  const pageShadow =
    pageLayout.pageBorder.mode === 'shadow'
      ? `0 0 ${Math.max(8, pageLayout.pageBorder.width * 6)}px ${pageLayout.pageBorder.color}`
      : '';
  const pageContentHeightMm = pageMetrics.contentHeightMm;
  const fullPageHeightMm = pageMetrics.pageHeightMm;
  const fullPageHeightPx = pageMetrics.pageHeightPx;
  const pageContentTopPx = pageLayout.margins.top * zoom * MM_TO_PX;
  const pageContentWidthMm = page.width - pageLayout.margins.left - pageLayout.margins.right;
  const pageContentTopMm = pageLayout.margins.top;
  const pageContentLeftMm = pageLayout.margins.left;
  const [layoutResult, setLayoutResult] = useState<LayoutComputationResult>({
    pageCount: 1,
    breaks: [],
    contentHeightMm: fullPageHeightMm,
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, paragraph: false }),
      CustomParagraph,
      Highlight.configure({ multicolor: true }),
      Underline,
      Strike,
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: '开始撰写您的项目报告...' }),
      WordLists,
      WordStyles,
      ParagraphBorders,
      RevisionMark,
      Superscript,
      Subscript,
      LinkExtension.configure({ openOnClick: false, HTMLAttributes: { class: 'editor-link' } }),
      Table.configure({ resizable: true, allowTableNodeSelection: true }),
      TableRow,
      TableCell,
      TableHeader,
      TocBlock,
      ImagePlaceholder,
      TablePlaceholder,
      AuxiliaryBlock,
    ],
    content: '',
    autofocus: true,
    editable: true,
    onCreate: ({ editor: instance }) => {
      setFormatting(readFormattingState(instance));
      setWordCount(countWords(instance.getText()));
      setPageCount(1);
      setCurrentPage(1);
    },
    onUpdate: ({ editor: instance }) => {
      setWordCount(countWords(instance.getText()));
      setDirty(true);
      setFormatting(readFormattingState(instance));
      bumpRevisionRefreshKey();
      updatePageCountFromLayout();
      updateCurrentPageFromSelection(instance);
    },
    onSelectionUpdate: ({ editor: instance }) => {
      setSelectedText(
        instance.state.doc.textBetween(instance.state.selection.from, instance.state.selection.to, ' ')
      );
      setFormatting(readFormattingState(instance));
      updateCurrentPageFromSelection(instance);

      const flatNodes = flattenFrameworkNodes(frameworkNodesRef.current);
      const headingEntries: Array<{ text: string; pos: number }> = [];

      instance.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          headingEntries.push({ text: node.textContent.trim(), pos });
        }
      });

      const currentPos = instance.state.selection.from;
      const activeHeading = [...headingEntries].reverse().find((entry) => entry.pos <= currentPos);

      if (!activeHeading) {
        setActiveSection({ id: null, title: '' });
        return;
      }

      const matchedNode = flatNodes.find((node) => node.title.trim() === activeHeading.text);
      setActiveSection({
        id: matchedNode?.id ?? null,
        title: activeHeading.text,
      });
    },
    editorProps: {
      attributes: { class: 'tiptap-editor' },
      handleTextInput: (view, from, to, text) => {
        if (!trackRevisions) {
          return false;
        }

        const markType = view.state.schema.marks.revisionMark;
        if (!markType) {
          return false;
        }

        const revisionId = generateId();
        const createdAt = new Date().toISOString();
        const tr = view.state.tr.insertText(text, from, to);
        tr.addMark(
          from,
          from + text.length,
          markType.create({
            revisionId,
            revisionKind: 'insert',
            createdAt,
          })
        );
        view.dispatch(tr);
        return true;
      },
      handleKeyDown: (view, event) => {
        if (!trackRevisions) {
          return false;
        }

        if (event.key !== 'Backspace' && event.key !== 'Delete') {
          return false;
        }

        const markType = view.state.schema.marks.revisionMark;
        if (!markType) {
          return false;
        }

        const { from, to, empty } = view.state.selection;
        let start = from;
        let end = to;

        if (empty) {
          if (event.key === 'Backspace') {
            if (from <= 1) {
              return true;
            }
            start = from - 1;
            end = from;
          } else {
            if (from >= view.state.doc.content.size) {
              return true;
            }
            start = from;
            end = from + 1;
          }
        }

        if (start >= end) {
          return true;
        }

        const tr = view.state.tr.addMark(
          start,
          end,
          markType.create({
            revisionId: generateId(),
            revisionKind: 'delete',
            createdAt: new Date().toISOString(),
          })
        );
        tr.setSelection(TextSelection.create(tr.doc, start));
        view.dispatch(tr);
        return true;
      },
    },
  });

  const applyPagedFlowLayout = useCallback(() => {
    const contentRoot = contentHostRef.current?.querySelector('.ProseMirror') ?? null;
    if (!(contentRoot instanceof HTMLElement) || !editor) {
      return 1;
    }

    if (paginationInFlightRef.current) {
      return appliedBreaksRef.current.length > 0 ? Math.max(layoutResult.pageCount, 1) : Math.max(pageCount, 1);
    }

    paginationInFlightRef.current = true;

    try {
      if (appliedBreaksRef.current.length > 0) {
        setPageFlowBreaks(editor, []);
      }

      const snapshot = captureLayoutSnapshot(editor, contentRoot);
      if (snapshot.blocks.length === 0) {
        appliedBreaksRef.current = [];
        if (layoutResult.pageCount !== 1 || layoutResult.breaks.length !== 0) {
          setLayoutResult({
            pageCount: 1,
            breaks: [],
            contentHeightMm: fullPageHeightMm,
          });
        }
        return 1;
      }

      const layout = computeDocumentLayout(editor, snapshot, pageMetrics);
      const normalizedBreaks: PageFlowBreakSpec[] = layout.breaks.map((item) => ({
        pos: item.pos,
        height: Math.round(item.height),
        kind: item.kind ?? 'block',
      }));
      const nextSignature = JSON.stringify({
        pageCount: layout.pageCount,
        contentHeightMm: Math.round(layout.contentHeightMm),
        breaks: normalizedBreaks.map((item) => [item.pos, item.height, item.kind]),
      });

      if (lastLayoutSignatureRef.current === nextSignature) {
        return layout.pageCount;
      }

      if (!areBreaksEqual(appliedBreaksRef.current, normalizedBreaks)) {
        setPageFlowBreaks(editor, normalizedBreaks);
        appliedBreaksRef.current = normalizedBreaks;
      }

      if (
        layoutResult.pageCount !== layout.pageCount ||
        Math.round(layoutResult.contentHeightMm) !== Math.round(layout.contentHeightMm) ||
        layoutResult.breaks.length !== normalizedBreaks.length
      ) {
        setLayoutResult({
          pageCount: layout.pageCount,
          breaks: layout.breaks,
          contentHeightMm: layout.contentHeightMm,
        });
      }

      lastLayoutSignatureRef.current = nextSignature;

      return layout.pageCount;
    } finally {
      paginationInFlightRef.current = false;
    }
  }, [editor, fullPageHeightMm, layoutResult.breaks.length, layoutResult.contentHeightMm, layoutResult.pageCount, pageCount, pageMetrics]);

  const updatePageCountFromLayout = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (pageCountFrameRef.current !== null) {
      window.cancelAnimationFrame(pageCountFrameRef.current);
    }

    pageCountFrameRef.current = window.requestAnimationFrame(() => {
      pageCountFrameRef.current = null;
      const measuredPages = applyPagedFlowLayout();
      setPageCount(measuredPages);
    });
  }, [applyPagedFlowLayout, setPageCount]);

  const updateCurrentPageFromSelection = useCallback(
    (instance: NonNullable<typeof editor>) => {
      const contentRoot = contentHostRef.current?.querySelector('.ProseMirror');
      if (!(contentRoot instanceof HTMLElement)) {
        setCurrentPage(1);
        return;
      }

      try {
        const caretCoords = instance.view.coordsAtPos(instance.state.selection.from);
        const rootRect = contentRoot.getBoundingClientRect();
        const relativeTop = Math.max(0, caretCoords.top - rootRect.top + pageContentTopPx);
        const activePage = Math.max(1, Math.floor(relativeTop / fullPageHeightPx) + 1);
        setCurrentPage(Math.min(activePage, pageCount));
      } catch {
        setCurrentPage(1);
      }
    },
    [fullPageHeightPx, pageContentTopPx, pageCount, setCurrentPage]
  );

  useEffect(() => {
    setEditor(editor);
    formatPainter.setEditor(editor);
    setEngineAdapter({
      kind: 'legacy-tiptap',
      editor,
      capabilities: {
        selectionRead: true,
        selectionWrite: true,
        commandExecution: false,
        findReplace: false,
        visualSelectionToolbar: true,
        paragraphFormatting: true,
        structuralNavigation: true,
        revisionTracking: true,
        primaryFileSource: false,
      },
      getStatus: () => ({
        kind: 'legacy-tiptap',
        canEdit: Boolean(editor?.isEditable),
        pageCount: useEditorStore.getState().pageCount,
        wordCount: useEditorStore.getState().wordCount,
        selection: {
          selectedText: useEditorStore.getState().selectedText,
          activePage: useEditorStore.getState().currentPage,
        },
      }),
      getSelection: () => ({
        selectedText: useEditorStore.getState().selectedText,
        activePage: useEditorStore.getState().currentPage,
      }),
      replaceSelection: async (text: string) => {
        // The legacy TipTap adapter remains the write boundary for the local editor.
        // Higher-level UI flows should call documentEngineCommands instead of mutating
        // the editor directly so we can keep migrating toward a single engine contract.
        editor?.chain().focus().deleteSelection().insertContent(text).run();
        return {
          applied: true,
          selectedText: text,
        };
      },
      saveDocument: async () => {
        const currentDoc = useProjectStore.getState().doc;
        const pageCount = useEditorStore.getState().pageCount;
        const response = await ipcClient.invoke<IPCResponse>(
          IPC_CHANNELS.FILE_SAVE_DRAFT,
          syncDocumentWithState({
            ...currentDoc,
            editorContent: editor?.getJSON() || currentDoc.editorContent,
            documentState: {
              ...currentDoc.documentState,
              pageCount,
            },
            updatedAt: new Date().toISOString(),
          })
        );

        if (!response.success) {
          throw new Error(response.error || '保存失败');
        }
      },
    });

    return () => {
      setEditor(null);
      setEngineAdapter(null);
      setActiveSection({ id: null, title: '' });
      setFormatting(DEFAULT_SELECTION_FORMATTING);
      setPageCount(1);
      setCurrentPage(1);
      formatPainter.setEditor(null);
    };
  }, [editor, setActiveSection, setCurrentPage, setEditor, setEngineAdapter, setFormatting, setPageCount]);

  useEffect(() => {
    if (!editor) return;

    const updateAnchorAttributes = () => {
      const root = editor.view.dom;

      syncBlockNodeMetadata(editor);

      root.querySelectorAll('h1, h2, h3').forEach((element) => {
        const text = element.textContent?.trim() ?? '';
        const anchorId = text ? createDocumentAnchorId('heading', text) : '';
        if (anchorId) {
          element.setAttribute('id', anchorId);
          element.setAttribute('data-anchor-id', anchorId);
        } else {
          element.removeAttribute('id');
          element.removeAttribute('data-anchor-id');
        }
      });

      root.querySelectorAll('p.image-text').forEach((element) => {
        const text = element.textContent?.trim() ?? '';
        const anchorId = text ? createDocumentAnchorId('image', text) : '';
        if (anchorId) {
          element.setAttribute('id', anchorId);
          element.setAttribute('data-anchor-id', anchorId);
        } else {
          element.removeAttribute('id');
          element.removeAttribute('data-anchor-id');
        }
      });

      root.querySelectorAll('p.table-text').forEach((element) => {
        const text = element.textContent?.trim() ?? '';
        const anchorId = text ? createDocumentAnchorId('table', text) : '';
        if (anchorId) {
          element.setAttribute('id', anchorId);
          element.setAttribute('data-anchor-id', anchorId);
        } else {
          element.removeAttribute('id');
          element.removeAttribute('data-anchor-id');
        }
      });
    };

    updateAnchorAttributes();
    editor.on('update', updateAnchorAttributes);
    editor.on('selectionUpdate', updateAnchorAttributes);

    return () => {
      editor.off('update', updateAnchorAttributes);
      editor.off('selectionUpdate', updateAnchorAttributes);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    updatePageCountFromLayout();
    updateCurrentPageFromSelection(editor);

    const handleWindowResize = () => updatePageCountFromLayout();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (pageCountFrameRef.current !== null) {
        window.cancelAnimationFrame(pageCountFrameRef.current);
        pageCountFrameRef.current = null;
      }
    };
  }, [editor, updateCurrentPageFromSelection, updatePageCountFromLayout]);

  const populateFromFramework = useCallback(() => {
    if (!editor || frameworkNodes.length === 0 || hasLoadedContent(currentDocContent)) return;
    const frameworkKey = createFrameworkContentSignature(frameworkNodes);
    if (frameworkKey === prevFrameworkRef.current) return;
    prevFrameworkRef.current = frameworkKey;

    const imageCounter = { count: 0 };
    const tableCounter = { count: 0 };
    let html = '';

    for (const node of frameworkNodes) {
      html += generateStructuredContent(node, frameworkNodes, imageCounter, tableCounter);
    }

    if (frameworkContentAppliedRef.current === html) {
      return;
    }

    frameworkContentAppliedRef.current = html;
    editor.commands.setContent(html);
    updatePageCountFromLayout();
    updateCurrentPageFromSelection(editor);
  }, [currentDocContent, editor, frameworkNodes, updateCurrentPageFromSelection, updatePageCountFromLayout]);

  useEffect(() => {
    populateFromFramework();
  }, [populateFromFramework]);

  useEffect(() => {
    if (!editor || loadedDocIdRef.current === currentDocId) {
      return;
    }

    loadedDocIdRef.current = currentDocId;
    prevFrameworkRef.current = '';
    frameworkContentAppliedRef.current = '';
    lastLayoutSignatureRef.current = '';

    if (currentDocContent && Object.keys(currentDocContent).length > 0) {
      if (!hasLoadedContent(currentDocContent)) {
        populateFromFramework();
        return;
      }
      editor.commands.setContent(currentDocContent);
      updatePageCountFromLayout();
      updateCurrentPageFromSelection(editor);
      return;
    }

    if (frameworkNodes.length === 0) {
      editor.commands.setContent('');
      setPageCount(1);
      setCurrentPage(1);
    }
  }, [currentDocContent, currentDocId, editor, frameworkNodes.length, setCurrentPage, setPageCount, updateCurrentPageFromSelection, updatePageCountFromLayout]);

  const renderedPageCount = Math.max(layoutResult.pageCount, pageCount);
  const contentHeight = renderedPageCount * fullPageHeightMm;
  const contentSurfaceHeightMm = Math.max(
    pageContentHeightMm,
    renderedPageCount * page.height - pageLayout.margins.top - pageLayout.margins.bottom
  );
  const pageBodyMaskRects: PageBodyMaskRect[] = Array.from({ length: renderedPageCount }, (_, index) => {
    const pageTopMm = index * page.height;

    return [
      {
        key: `page-${index + 1}-header-mask`,
        topMm: pageTopMm,
        leftMm: 0,
        widthMm: page.width,
        heightMm: pageContentTopMm,
      },
      {
        key: `page-${index + 1}-left-mask`,
        topMm: pageTopMm + pageContentTopMm,
        leftMm: 0,
        widthMm: pageContentLeftMm,
        heightMm: pageContentHeightMm,
      },
      {
        key: `page-${index + 1}-right-mask`,
        topMm: pageTopMm + pageContentTopMm,
        leftMm: pageContentLeftMm + pageContentWidthMm,
        widthMm: Math.max(0, page.width - pageContentLeftMm - pageContentWidthMm),
        heightMm: pageContentHeightMm,
      },
      {
        key: `page-${index + 1}-footer-mask`,
        topMm: pageTopMm + pageContentTopMm + pageContentHeightMm,
        leftMm: 0,
        widthMm: page.width,
        heightMm: Math.max(0, page.height - pageContentTopMm - pageContentHeightMm),
      },
    ];
  }).flat().filter((rect) => rect.widthMm > 0 && rect.heightMm > 0);

  if (!editor) {
    return (
      <div
        style={{
          width: `${page.width}mm`,
          minHeight: `${page.height}mm`,
          background: '#fff',
          margin: '0 auto',
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: `${page.width * zoom}mm`,
        margin: '0 auto',
        transformOrigin: 'top center',
        position: 'relative',
        minHeight: `${contentHeight * zoom}mm`,
        paddingBottom: `${16 * zoom}px`,
      }}
    >
      {Array.from({ length: renderedPageCount }, (_, index) => (
        <div key={index}>
          <div
            style={{
              position: 'absolute',
              top: `${index * page.height * zoom}mm`,
              left: 0,
              width: `${page.width * zoom}mm`,
              minHeight: `${page.height * zoom}mm`,
              background: '#fff',
              boxShadow:
                index + 1 === currentPage
                  ? `0 0 0 1px rgba(22,119,255,0.16), 0 6px 18px rgba(15,23,42,0.10)${
                      pageShadow ? `, ${pageShadow}` : ''
                    }`
                  : `0 1px 4px rgba(15,23,42,0.08)${pageShadow ? `, ${pageShadow}` : ''}`,
              border: pageBorder,
              padding: `${pageLayout.margins.top * zoom}mm ${pageLayout.margins.right * zoom}mm ${pageLayout.margins.bottom * zoom}mm ${pageLayout.margins.left * zoom}mm`,
              zIndex: 0,
              pointerEvents: 'none',
              borderRadius: `${2 * zoom}px`,
            }}
          />

          {pageLayout.watermark.enabled ? (
            <div
              style={{
                position: 'absolute',
                top: `${index * page.height * zoom}mm`,
                left: 0,
                width: `${page.width * zoom}mm`,
                minHeight: `${page.height * zoom}mm`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: pageLayout.watermark.color,
                opacity: pageLayout.watermark.opacity,
                fontSize: `${Math.max(46, 72 * zoom)}px`,
                fontWeight: 700,
                letterSpacing: '0.12em',
                transform: `rotate(${pageLayout.watermark.rotation}deg)`,
                transformOrigin: 'center center',
                pointerEvents: 'none',
                zIndex: 1,
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {pageLayout.watermark.text}
            </div>
          ) : null}

          <div
            style={{
              position: 'absolute',
              top: `${index * page.height * zoom}mm`,
              left: 0,
              width: `${page.width * zoom}mm`,
              minHeight: `${page.height * zoom}mm`,
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: `${pageLayout.margins.left * zoom}mm`,
                right: `${pageLayout.margins.right * zoom}mm`,
                height: `${pageLayout.margins.top * zoom}mm`,
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 78%, rgba(255,255,255,0) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: `${(pageLayout.margins.top + pageContentHeightMm) * zoom}mm`,
                left: `${pageLayout.margins.left * zoom}mm`,
                right: `${pageLayout.margins.right * zoom}mm`,
                height: `${pageLayout.margins.bottom * zoom}mm`,
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.94) 22%, rgba(255,255,255,0.99) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: `${pageLayout.margins.top * zoom}mm`,
                left: `${pageLayout.margins.left * zoom}mm`,
                right: `${pageLayout.margins.right * zoom}mm`,
                height: `${pageContentHeightMm * zoom}mm`,
                boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.02)',
              }}
            />
          </div>

          <div
            style={{
              position: 'absolute',
              top: `${index * page.height * zoom}mm`,
              left: 0,
              width: `${page.width * zoom}mm`,
              minHeight: `${page.height * zoom}mm`,
              zIndex: 3,
              pointerEvents: 'none',
            }}
          >
            <PageHeaderFooterLayer
              pageNumber={index + 1}
              pageWidth={page.width}
              pageHeight={page.height}
              marginLeft={pageLayout.margins.left}
              marginRight={pageLayout.margins.right}
              headerOffset={pageLayout.headerOffset}
              footerOffset={pageLayout.footerOffset}
              zoom={zoom}
            />
          </div>
        </div>
      ))}

      {Array.from({ length: Math.max(0, renderedPageCount - 1) }, (_, index) => (
        <div
          key={`gap-${index}`}
          style={{
            position: 'absolute',
            top: `calc(${(index + 1) * page.height * zoom}mm - ${6 * zoom}px)`,
            left: 0,
            right: 0,
            height: `${12 * zoom}px`,
            background:
              'linear-gradient(180deg, rgba(184,184,184,0) 0%, rgba(184,184,184,0.70) 50%, rgba(184,184,184,0) 100%)',
            zIndex: 4,
            pointerEvents: 'none',
          }}
        />
      ))}

      {pageBodyMaskRects.map((rect) => (
        <div
          key={rect.key}
          className="qiu-page-hit-mask"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          style={{
            position: 'absolute',
            top: `${rect.topMm * zoom}mm`,
            left: `${rect.leftMm * zoom}mm`,
            width: `${rect.widthMm * zoom}mm`,
            height: `${rect.heightMm * zoom}mm`,
            zIndex: 5,
            cursor: 'default',
          }}
        />
      ))}

      <div
        ref={contentHostRef}
        className={`qiu-page-layout-surface${pageLayout.columns.count > 1 ? ' columns-mode' : ''}`}
        style={{
          position: 'absolute',
          zIndex: 2,
          top: `${pageContentTopMm * zoom}mm`,
          left: `${pageContentLeftMm * zoom}mm`,
          width: `${pageContentWidthMm * zoom}mm`,
          minHeight: `${contentSurfaceHeightMm * zoom}mm`,
          maxWidth: `${pageContentWidthMm * zoom}mm`,
          overflow: 'hidden',
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

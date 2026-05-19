import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import TextStyle from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import LinkExtension from '@tiptap/extension-link';
import { useEffect, useCallback, useRef } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import { countWords, type FrameworkNode } from '@qiuai/shared';
import { ImagePlaceholder } from './extensions/ImagePlaceholder';
import { TablePlaceholder } from './extensions/TablePlaceholder';
import { CustomParagraph } from './extensions/CustomParagraph';
import { WordLists } from './extensions/WordLists';
import { WordStyles } from './extensions/WordStyles';
import { ParagraphBorders } from './extensions/ParagraphBorders';
import { formatPainter } from '../../services/formatPainter';

// A4 dimensions in mm
const A4_H = 297;
const MARGIN_TOP = 25.4;
const MARGIN_BOTTOM = 25.4;
const MARGIN_LEFT = 31.7;
const MARGIN_RIGHT = 31.7;
const CONTENT_H = A4_H - MARGIN_TOP - MARGIN_BOTTOM;
const CHARS_PER_PAGE = 500; // approx Chinese chars per A4 page

function getSectionPath(nodeId: string, nodes: FrameworkNode[], parentPath = ''): string {
  for (const node of nodes) {
    const path = parentPath ? `${parentPath}.${node.order}` : String(node.order);
    if (node.id === nodeId) return path;
    const found = getSectionPath(nodeId, node.children, path);
    if (found) return found;
  }
  return '';
}

function generateStructuredContent(
  node: FrameworkNode, allNodes: FrameworkNode[],
  imgCounter: { count: number }, tblCounter: { count: number }
): string {
  const sectionPath = getSectionPath(node.id, allNodes);
  const level = Math.min(node.level, 3);
  let html = `<h${level}>${esc(node.title)}</h${level}>`;
  html += `<p class="subtitle-text" data-placeholder="小标题文本">在此输入${esc(node.title)}的简要说明...</p>`;

  if (node.needsImage) {
    imgCounter.count++;
    html += `<div data-type="image-placeholder" class="image-placeholder-node" contenteditable="false"><div class="image-placeholder-box"><div class="image-placeholder-icon">🖼</div><div class="image-placeholder-hint">双击或拖放图片到此处</div></div><div class="image-placeholder-caption" contenteditable="true">图${sectionPath}.${imgCounter.count} 图片标题</div></div>`;
    html += `<p class="image-text" data-placeholder="图片文本">上图展示了${esc(node.title)}相关内容。</p>`;
  }
  if (node.needsTable) {
    tblCounter.count++;
    html += `<div data-type="table-placeholder" class="table-placeholder-node" contenteditable="false"><table class="three-line-placeholder-table"><thead><tr><th>列1</th><th>列2</th><th>列3</th></tr></thead><tbody><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><div class="table-placeholder-caption" contenteditable="true">表${sectionPath}.${tblCounter.count} 表格标题</div></div>`;
    html += `<p class="table-text" data-placeholder="表格文本">上表列出了${esc(node.title)}相关数据。</p>`;
  }
  html += `<p class="body-text" data-placeholder="正文内容">此处为「${esc(node.title)}」的正文内容。</p>`;
  for (const child of node.children) {
    html += generateStructuredContent(child, allNodes, imgCounter, tblCounter);
  }
  return html;
}

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface EditorContainerProps {
  zoom?: number;
}

export function EditorContainer({ zoom = 1 }: EditorContainerProps) {
  const setEditor = useEditorStore((s) => s.setEditor);
  const setWordCount = useEditorStore((s) => s.setWordCount);
  const setDirty = useEditorStore((s) => s.setDirty);
  const setSelectedText = useEditorStore((s) => s.setSelectedText);
  const frameworkNodes = useFrameworkStore((s) => s.nodes);
  const prevFrameworkRef = useRef('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, paragraph: false }),
      CustomParagraph,
      Highlight.configure({ multicolor: true }),
      Underline, Strike, TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: '开始写作您的申报书...' }),
      WordLists, WordStyles, ParagraphBorders,
      Superscript, Subscript,
      LinkExtension.configure({ openOnClick: false, HTMLAttributes: { class: 'editor-link' } }),
      Table.configure({ resizable: true, allowTableNodeSelection: true }),
      TableRow, TableCell, TableHeader,
      ImagePlaceholder, TablePlaceholder,
    ],
    content: '',
    autofocus: true, editable: true,
    onUpdate: ({ editor: ed }) => { setWordCount(countWords(ed.getText())); setDirty(true); },
    onSelectionUpdate: ({ editor: ed }) => {
      setSelectedText(ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to, ' '));
    },
    editorProps: { attributes: { class: 'tiptap-editor' } },
  });

  useEffect(() => { setEditor(editor); formatPainter.setEditor(editor); return () => { setEditor(null); formatPainter.setEditor(null); }; }, [editor, setEditor]);

  const populateFromFramework = useCallback(() => {
    if (!editor || frameworkNodes.length === 0) return;
    const fk = JSON.stringify(frameworkNodes.map(n => n.id).sort());
    if (fk === prevFrameworkRef.current) return;
    prevFrameworkRef.current = fk;
    const img = { count: 0 }, tbl = { count: 0 };
    let html = '';
    for (const n of frameworkNodes) html += generateStructuredContent(n, frameworkNodes, img, tbl);
    editor.commands.setContent(html);
  }, [editor, frameworkNodes]);

  useEffect(() => { populateFromFramework(); }, [populateFromFramework]);

  // Calculate estimated pages
  const wordCount = useEditorStore((s) => s.wordCount);
  const estimatedPages = Math.max(1, Math.ceil(wordCount / CHARS_PER_PAGE));

  if (!editor) {
    return <div style={{ width: '210mm', minHeight: '297mm', background: '#fff', margin: '0 auto' }} />;
  }

  return (
    <div style={{
      width: `${210 * zoom}mm`,
      margin: '0 auto',
      transformOrigin: 'top center',
      position: 'relative',
    }}>
      {/* Page backgrounds rendered behind the editor */}
      {Array.from({ length: estimatedPages }, (_, i) => (
        <div key={i} style={{
          position: 'absolute', top: `${i * A4_H * zoom}mm`,
          width: `${210 * zoom}mm`, minHeight: `${A4_H * zoom}mm`,
          background: '#fff',
          boxShadow: `0 1px 3px rgba(0,0,0,0.1)`,
          padding: `${MARGIN_TOP * zoom}mm ${MARGIN_RIGHT * zoom}mm ${MARGIN_BOTTOM * zoom}mm ${MARGIN_LEFT * zoom}mm`,
          zIndex: 0,
          pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        }}>
          {/* Page number (subtle, at bottom center) */}
          <div style={{ textAlign: 'center', fontSize: `${8 * zoom}pt`, color: '#bbb', position: 'absolute', bottom: `${(MARGIN_BOTTOM / 3) * zoom}mm`, left: 0, right: 0 }}>
            {i + 1}
          </div>
        </div>
      ))}

      {/* Page gap indicators */}
      {Array.from({ length: estimatedPages - 1 }, (_, i) => (
        <div key={`gap-${i}`} style={{
          position: 'absolute',
          top: `${((i + 1) * A4_H) * zoom}mm`,
          left: 0, right: 0,
          height: `${16 * zoom}px`,
          background: '#c8c8c8',
          zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 40, height: 1, background: '#bbb' }} />
        </div>
      ))}

      {/* Editor content (on top of pages) */}
      <div style={{
        position: 'relative', zIndex: 2,
        padding: `${MARGIN_TOP * zoom}mm ${MARGIN_RIGHT * zoom}mm ${MARGIN_BOTTOM * zoom}mm ${MARGIN_LEFT * zoom}mm`,
        minHeight: `${A4_H * zoom}mm`,
      }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

import {
  hasMeaningfulEditorContent,
  resolvePageSlotText,
  syncDocumentWithState,
  type QiuAiDocument,
} from '@qiuai/shared';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getParagraphClass(node: any): string {
  return typeof node?.attrs?.class === 'string' ? node.attrs.class.trim() : '';
}

function getMark(marks: any[], type: string): any | undefined {
  return (marks || []).find((mark: any) => mark?.type === type);
}

function renderInlineText(child: any): string {
  const rawText = escapeHtml(child.text || '');
  const marks = child.marks || [];
  let content = rawText;
  const textStyleMark = getMark(marks, 'textStyle');
  const highlightMark = getMark(marks, 'highlight');

  if (marks.some((mark: any) => mark.type === 'bold')) {
    content = `<strong>${content}</strong>`;
  }

  if (marks.some((mark: any) => mark.type === 'italic')) {
    content = `<em>${content}</em>`;
  }

  if (marks.some((mark: any) => mark.type === 'underline')) {
    content = `<u>${content}</u>`;
  }

  if (marks.some((mark: any) => mark.type === 'strike')) {
    content = `<s>${content}</s>`;
  }

  if (marks.some((mark: any) => mark.type === 'subscript')) {
    content = `<sub>${content}</sub>`;
  }

  if (marks.some((mark: any) => mark.type === 'superscript')) {
    content = `<sup>${content}</sup>`;
  }

  const inlineStyles = [
    typeof textStyleMark?.attrs?.color === 'string' ? `color:${textStyleMark.attrs.color}` : '',
    typeof textStyleMark?.attrs?.fontSize === 'string' ? `font-size:${textStyleMark.attrs.fontSize}` : '',
    typeof textStyleMark?.attrs?.fontFamily === 'string' ? `font-family:${textStyleMark.attrs.fontFamily}` : '',
    typeof highlightMark?.attrs?.color === 'string' ? `background-color:${highlightMark.attrs.color}` : '',
  ].filter(Boolean);

  if (inlineStyles.length > 0) {
    content = `<span style="${inlineStyles.join(';')}">${content}</span>`;
  }

  const linkMark = marks.find((mark: any) => mark.type === 'link');
  if (linkMark?.attrs?.href) {
    const href = escapeHtml(String(linkMark.attrs.href));
    content = `<a class="editor-link" href="${href}">${content}</a>`;
  }

  return content;
}

function proseMirrorNodeToHtml(node: any): string {
  if (!node || !node.type) {
    return '';
  }

  switch (node.type) {
    case 'doc':
      return (node.content || []).map(proseMirrorNodeToHtml).join('\n');
    case 'heading': {
      const level = Math.min(node.attrs?.level || 1, 3);
      const text = (node.content || []).map(proseMirrorNodeToHtml).join('');
      return `<h${level}>${text || '&nbsp;'}</h${level}>`;
    }
    case 'paragraph': {
      const paragraphClass = getParagraphClass(node);
      const text = (node.content || [])
        .map((child: any) => {
          if (child.type !== 'text') {
            return '';
          }
          return renderInlineText(child);
        })
        .join('');

      if (paragraphClass === 'page-break') {
        return '<div class="page-break"></div>';
      }

      if (paragraphClass === 'page-number-field') {
        return `<p class="page-number-field">${text || 'Page Number'}</p>`;
      }

      if (paragraphClass === 'math-block') {
        return `<p class="math-block">${text || 'Equation'}</p>`;
      }

      return text.trim() ? `<p>${text}</p>` : '<p>&nbsp;</p>';
    }
    case 'table': {
      let html = '<table><tbody>';
      (node.content || []).forEach((row: any) => {
        html += '<tr>';
        (row.content || []).forEach((cell: any) => {
          const text = (cell.content || []).map(proseMirrorNodeToHtml).join('');
          html += `<td>${text || '&nbsp;'}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      return html;
    }
    case 'image':
      return `<img src="${escapeHtml(node.attrs?.src || '')}" alt="${escapeHtml(node.attrs?.alt || '')}" />`;
    case 'imagePlaceholder': {
      const caption = escapeHtml(node.attrs?.caption || 'Image');
      const imageData = typeof node.attrs?.imageData === 'string' ? node.attrs.imageData : '';
      if (imageData) {
        return `<figure class="image-placeholder-print"><img src="${escapeHtml(imageData)}" alt="${caption}" /></figure>`;
      }
      return `<figure class="image-placeholder-print image-placeholder-empty"><div class="image-placeholder-box">${caption}</div></figure>`;
    }
    case 'tocBlock': {
      const title = escapeHtml(String(node.attrs?.title || '目录'));
      const withPageNumbers = Boolean(node.attrs?.withPageNumbers);
      const entries = Array.isArray(node.attrs?.entries) ? node.attrs.entries : [];
      const entryHtml = entries
        .map((entry: any) => {
          const level = Math.min(Math.max(Number(entry?.level || 1), 1), 3);
          const label = escapeHtml(String(entry?.label || ''));
          const anchorId = escapeHtml(String(entry?.anchorId || ''));
          const page = escapeHtml(String(entry?.page || ''));
          return `<p class="toc-entry" data-toc-level="${level}" data-toc-target="${anchorId}"><span>${'&emsp;'.repeat(Math.max(level - 1, 0))}<a class="editor-link" href="#${anchorId}">${label}</a></span>${withPageNumbers ? `<span class="toc-page-number">${page}</span>` : ''}</p>`;
        })
        .join('');
      return `<section class="toc-block" data-generated="true"><h1>${title}</h1><p>&nbsp;</p>${entryHtml}</section>`;
    }
    case 'auxiliaryBlock': {
      const kind = escapeHtml(String(node.attrs?.kind || 'textBox'));
      const title = escapeHtml(String(node.attrs?.title || '文本框'));
      const body = escapeHtml(String(node.attrs?.body || ''));
      return `<section class="auxiliary-block auxiliary-block-${kind}" data-kind="${kind}"><header>${title}</header><div>${body || '&nbsp;'}</div></section>`;
    }
    case 'text':
      return renderInlineText(node);
    default:
      return '';
  }
}

function buildDocumentBodyHtml(doc: QiuAiDocument): string {
  const normalized = syncDocumentWithState(doc);
  const content = normalized.editorContent as any;

  if (hasMeaningfulEditorContent(content) && content?.content) {
    const bodyHtml = content.content.map(proseMirrorNodeToHtml).join('\n');
    if (bodyHtml.trim()) {
      return bodyHtml;
    }
  }

  return normalized.framework
    .map((node) => `<h${node.level}>${escapeHtml(node.title)}</h${node.level}><p>正文内容待补充。</p>`)
    .join('\n');
}

export function buildDocumentHtml(doc: QiuAiDocument): string {
  const normalized = syncDocumentWithState(doc);
  const pageLayout = normalized.documentState.pageLayout;
  const documentMeta = normalized.documentState.documentMeta;
  const pageWidth = pageLayout.orientation === 'landscape' ? 297 : 210;
  const pageHeight = pageLayout.orientation === 'landscape' ? 210 : 297;
  const pageSize = pageLayout.orientation === 'landscape' ? 'A4 landscape' : 'A4';
  const headerText = resolvePageSlotText(pageLayout, 'header', 1, normalized.title);
  const footerText = resolvePageSlotText(pageLayout, 'footer', 1, '');
  const bodyHtml = buildDocumentBodyHtml(normalized);
  const pageBorder =
    pageLayout.pageBorder.mode === 'box'
      ? `${pageLayout.pageBorder.width}pt ${pageLayout.pageBorder.lineStyle} ${pageLayout.pageBorder.color}`
      : 'none';
  const pageShadow =
    pageLayout.pageBorder.mode === 'shadow'
      ? `0 0 ${Math.max(8, pageLayout.pageBorder.width * 6)}px ${pageLayout.pageBorder.color}`
      : '0 8px 28px rgba(15, 23, 42, 0.12)';
  const bodyColumns =
    pageLayout.columns.count > 1
      ? `
.document-body {
  column-count: ${pageLayout.columns.count};
  column-gap: ${pageLayout.columns.gap}mm;
  column-rule: ${pageLayout.columns.separator ? '1px solid #d9d9d9' : 'none'};
}
.document-body > * {
  break-inside: avoid;
}
`
      : '';
  const watermarkHtml = pageLayout.watermark.enabled
    ? `<div class="page-watermark">${escapeHtml(pageLayout.watermark.text)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(normalized.title)}</title>
<meta name="author" content="${escapeHtml(documentMeta.author || '')}"/>
<meta name="subject" content="${escapeHtml(documentMeta.subject || '')}"/>
<meta name="keywords" content="${escapeHtml((documentMeta.keywords || []).join(', '))}"/>
<style>
@page {
  size: ${pageSize};
  margin: ${pageLayout.margins.top}mm ${pageLayout.margins.right}mm ${pageLayout.margins.bottom}mm ${pageLayout.margins.left}mm;
}
body {
  font-family: 'FangSong', 'SimSun', serif;
  font-size: 16pt;
  line-height: 28pt;
  color: #000;
  background: #f3f4f6;
  margin: 0;
  padding: 24px 0;
}
.page {
  box-sizing: border-box;
  width: ${pageWidth}mm;
  min-height: ${pageHeight}mm;
  margin: 0 auto;
  background: #fff;
  box-shadow: ${pageShadow};
  border: ${pageBorder};
  padding: ${pageLayout.margins.top}mm ${pageLayout.margins.right}mm ${pageLayout.margins.bottom}mm ${pageLayout.margins.left}mm;
  position: relative;
}
.print-header,
.print-footer {
  position: absolute;
  left: ${pageLayout.margins.left}mm;
  right: ${pageLayout.margins.right}mm;
  color: #595959;
  font-size: 10.5pt;
  text-align: center;
}
.print-header {
  top: ${pageLayout.headerOffset}mm;
}
.print-footer {
  bottom: ${pageLayout.footerOffset}mm;
}
.document-body {
  min-height: calc(${pageHeight}mm - ${pageLayout.margins.top + pageLayout.margins.bottom}mm);
}
.page-watermark {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 72pt;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: ${pageLayout.watermark.color};
  opacity: ${pageLayout.watermark.opacity};
  transform: rotate(${pageLayout.watermark.rotation}deg);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
}
h1 { font-family: 'SimHei', sans-serif; font-size: 22pt; text-align: center; margin: 24px 0 16px; }
h2 { font-family: 'SimHei', sans-serif; font-size: 16pt; margin: 20px 0 12px; }
h3 { font-family: 'SimHei', sans-serif; font-size: 14pt; margin: 16px 0 10px; }
p { text-indent: 2em; margin: 0 0 8px; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; }
table thead { border-top: 1.5pt solid #000; border-bottom: 0.75pt solid #000; }
table tbody { border-bottom: 1.5pt solid #000; }
th, td { padding: 4pt 8pt; text-align: center; font-size: 10.5pt; border: none; }
img { max-width: 100%; height: auto; }
.page-break { break-before: page; page-break-before: always; height: 0; margin: 0; }
.page-number-field { text-indent: 0; text-align: center; color: #595959; }
.math-block { text-indent: 0; text-align: center; }
.toc-block { margin: 18pt 0 24pt; }
.toc-block h1 { margin-bottom: 18pt; }
.toc-entry { text-indent: 0; margin: 4pt 0; display: flex; justify-content: space-between; gap: 16pt; }
.toc-entry[data-toc-level="1"] { font-size: 16pt; }
.toc-entry[data-toc-level="2"] { font-size: 14pt; }
.toc-entry[data-toc-level="3"] { font-size: 12pt; }
.toc-entry a { color: inherit; text-decoration: none; }
.toc-page-number { color: #595959; flex-shrink: 0; }
.image-placeholder-print { margin: 12pt 0; text-align: center; }
.image-placeholder-box {
  border: 1px dashed #9ca3af;
  background: #f9fafb;
  color: #6b7280;
  min-height: 96pt;
  display: flex;
  align-items: center;
  justify-content: center;
}
.auxiliary-block {
  margin: 12pt 0 16pt;
  padding: 12pt 14pt;
  border: 1pt solid #cbd5e1;
  border-left: 4pt solid #64748b;
  background: #f8fafc;
  break-inside: avoid;
}
.auxiliary-block header {
  margin: 0 0 6pt;
  font-family: 'SimHei', sans-serif;
  font-size: 11pt;
  color: #1f2937;
}
.auxiliary-block div {
  font-size: 10.5pt;
  line-height: 1.8;
  color: #475569;
  text-indent: 0;
}
.auxiliary-block-shape {
  border-left-color: #2563eb;
  background: #eff6ff;
}
.auxiliary-block-chart {
  border-left-color: #0f766e;
  background: #f0fdfa;
}
.auxiliary-block-textBox {
  border-left-color: #7c3aed;
  background: #faf5ff;
}
${bodyColumns}
@media print {
  body {
    background: #fff;
    padding: 0;
  }
  .page {
    box-shadow: none;
    margin: 0;
  }
}
</style>
</head>
<body>
  <div class="page">
    ${watermarkHtml}
    ${headerText ? `<div class="print-header">${escapeHtml(headerText)}</div>` : ''}
    ${footerText ? `<div class="print-footer">${escapeHtml(footerText)}</div>` : ''}
    <main class="document-body">
      <h1>${escapeHtml(normalized.title)}</h1>
      ${bodyHtml}
    </main>
  </div>
</body>
</html>`;
}

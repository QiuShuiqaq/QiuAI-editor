import fs from 'node:fs/promises';
import {
  hasMeaningfulEditorContent,
  resolvePageSlotText,
  syncDocumentWithState,
  type FrameworkNode,
  type QiuAiDocument,
} from '@qiuai/shared';

class ExportService {
  async exportDOCX(doc: QiuAiDocument, filePath: string): Promise<void> {
    try {
      const normalizedDoc = syncDocumentWithState(doc);
      if (
        normalizedDoc.documentState.authoringSource.kind === 'docx-file' &&
        normalizedDoc.documentState.authoringSource.path
      ) {
        try {
          await fs.copyFile(normalizedDoc.documentState.authoringSource.path, filePath);
          return;
        } catch {
          // Fall back to reconstruction when the working DOCX is unavailable.
        }
      }

      const docxModule = await import('docx');
      const {
        AlignmentType,
        Document,
        Footer,
        Header,
        HeadingLevel,
        Packer,
        PageNumber,
        Paragraph,
        Table,
        TableCell,
        TableRow,
        TextRun,
        WidthType,
      } = docxModule;

      const pageLayout = normalizedDoc.documentState.pageLayout;
      const isLandscape = pageLayout.orientation === 'landscape';
      const headerText = normalizedDoc.title || '项目报告';
      const footerText = '';
      const children: any[] = [];
      const editorContent = normalizedDoc.editorContent as any;
      const sourceHtml =
        normalizedDoc.documentState.authoringSource.kind === 'html-file' &&
        normalizedDoc.documentState.authoringSource.path
          ? await fs.readFile(normalizedDoc.documentState.authoringSource.path, 'utf-8')
          : null;

      if (normalizedDoc.title) {
        children.push(
          new Paragraph({
            text: normalizedDoc.title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          })
        );
      }

      if (sourceHtml) {
        const htmlChildren = convertHtmlToDocxChildren(sourceHtml, docxModule);
        if (htmlChildren.length > 0) {
          children.push(...htmlChildren);
        }
      }

      if (
        children.length <= 1 &&
        hasMeaningfulEditorContent(editorContent) &&
        editorContent &&
        typeof editorContent === 'object' &&
        Array.isArray(editorContent.content)
      ) {
        for (const node of editorContent.content) {
          const converted = convertProseMirrorNode(node, docxModule);
          if (!converted) {
            continue;
          }
          if (Array.isArray(converted)) {
            children.push(...converted);
          } else {
            children.push(converted);
          }
        }
      }

      if (children.length <= 1) {
        for (const node of flattenFrameworkNodes(normalizedDoc.framework)) {
          children.push(
            new Paragraph({
              text: node.title,
              heading: headingLevelFromNumber(node.level, HeadingLevel),
              spacing: { before: 240, after: 120 },
            })
          );
          children.push(
            new Paragraph({
              text: '正文内容待补充。',
              spacing: { after: 120 },
            })
          );
        }
      }

      const footerRuns = [
        ...(footerText ? [new TextRun({ text: `${footerText}  ` })] : []),
        new TextRun({ text: '第 ' }),
        new TextRun({ children: [PageNumber.CURRENT] }),
        new TextRun({ text: ' 页' }),
      ];

      const docxDoc = new Document({
        styles: {
          default: {
            document: {
              run: {
                font: 'FangSong',
                size: 32,
              },
            },
          },
        },
        sections: [
          {
            properties: {
              page: {
                size: isLandscape
                  ? { width: 16838, height: 11906 }
                  : { width: 11906, height: 16838 },
                margin: {
                  top: mmToTwip(pageLayout.margins.top),
                  bottom: mmToTwip(pageLayout.margins.bottom),
                  left: mmToTwip(pageLayout.margins.left),
                  right: mmToTwip(pageLayout.margins.right),
                  header: mmToTwip(pageLayout.headerOffset),
                  footer: mmToTwip(pageLayout.footerOffset),
                },
              },
            },
            headers: {
              default: new Header({
                children: [
                  new Paragraph({
                    text: headerText,
                    alignment: AlignmentType.CENTER,
                  }),
                ],
              }),
            },
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({
                    children: footerRuns,
                    alignment: AlignmentType.CENTER,
                  }),
                ],
              }),
            },
            children,
          },
        ],
      });

      const buffer = await Packer.toBuffer(docxDoc);
      await fs.writeFile(filePath, buffer);
    } catch (error) {
      console.error('DOCX export error:', error);
      await this.exportHTML(doc, filePath, 'docx');
    }
  }

  async exportPDF(doc: QiuAiDocument, filePath: string): Promise<void> {
    try {
      const normalizedDoc = syncDocumentWithState(doc);
      if (
        normalizedDoc.documentState.authoringSource.kind === 'html-file' &&
        normalizedDoc.documentState.authoringSource.path
      ) {
        try {
          const sourceHtml = await fs.readFile(normalizedDoc.documentState.authoringSource.path, 'utf-8');
          await fs.writeFile(filePath.replace(/\.pdf$/i, '.html'), sourceHtml, 'utf-8');
          return;
        } catch {
          // Fall back to generated HTML when the working HTML is unavailable.
        }
      }

      const html = this.generatePrintableHTML(doc);
      await fs.writeFile(filePath.replace(/\.pdf$/i, '.html'), html, 'utf-8');
    } catch (error) {
      console.error('PDF export error:', error);
      await this.exportHTML(doc, filePath, 'pdf');
    }
  }

  generateDebugPrintableHTML(doc: QiuAiDocument): string {
    return this.generatePrintableHTML(doc);
  }

  private async exportHTML(doc: QiuAiDocument, filePath: string, _format: string): Promise<void> {
    const normalizedDoc = syncDocumentWithState(doc);
    if (
      normalizedDoc.documentState.authoringSource.kind === 'html-file' &&
      normalizedDoc.documentState.authoringSource.path
    ) {
      try {
        const sourceHtml = await fs.readFile(normalizedDoc.documentState.authoringSource.path, 'utf-8');
        await fs.writeFile(filePath.replace(/\.(docx|pdf)$/i, '.html'), sourceHtml, 'utf-8');
        return;
      } catch {
        // Fall through to regenerated HTML.
      }
    }

    const html = this.generatePrintableHTML(doc);
    await fs.writeFile(filePath.replace(/\.(docx|pdf)$/i, '.html'), html, 'utf-8');
  }

  private generatePrintableHTML(doc: QiuAiDocument): string {
    const normalizedDoc = syncDocumentWithState(doc);
    const documentMeta = normalizedDoc.documentState.documentMeta;
    const pageLayout = normalizedDoc.documentState.pageLayout;
    const pageSize = pageLayout.orientation === 'landscape' ? 'A4 landscape' : 'A4';
    const pageWidth = pageLayout.orientation === 'landscape' ? 297 : 210;
    const pageHeight = pageLayout.orientation === 'landscape' ? 210 : 297;
    const headerText = resolvePageSlotText(pageLayout, 'header', 1, normalizedDoc.title);
    const footerText = resolvePageSlotText(pageLayout, 'footer', 1, '');
    const pageBorder =
      pageLayout.pageBorder.mode === 'box'
        ? `${pageLayout.pageBorder.width}pt ${pageLayout.pageBorder.lineStyle} ${pageLayout.pageBorder.color}`
        : 'none';
    const pageShadow =
      pageLayout.pageBorder.mode === 'shadow'
        ? `0 0 ${Math.max(8, pageLayout.pageBorder.width * 6)}px ${pageLayout.pageBorder.color}`
        : 'none';
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
    }`
        : '';
    const watermarkHtml = pageLayout.watermark.enabled
      ? `<div class="page-watermark">${escapeHtml(pageLayout.watermark.text)}</div>`
      : '';
    let bodyHTML = '';

    if (hasMeaningfulEditorContent(normalizedDoc.editorContent)) {
      const content = normalizedDoc.editorContent as any;
      if (Array.isArray(content.content)) {
        bodyHTML = content.content.map((node: any) => proseMirrorNodeToHTML(node)).join('\n');
      }
    }

    if (!bodyHTML) {
      bodyHTML = flattenFrameworkNodes(normalizedDoc.framework)
        .map((node) => `<h${node.level}>${escapeHtml(node.title)}</h${node.level}><p>正文内容待补充。</p>`)
        .join('\n');
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(normalizedDoc.title)}</title>
  <meta name="author" content="${escapeHtml(documentMeta.author || '')}"/>
  <meta name="subject" content="${escapeHtml(documentMeta.subject || '')}"/>
  <meta name="keywords" content="${escapeHtml((documentMeta.keywords || []).join(', '))}"/>
  <style>
    @page {
      size: ${pageSize};
      margin: ${pageLayout.margins.top}mm ${pageLayout.margins.right}mm ${pageLayout.margins.bottom}mm ${pageLayout.margins.left}mm;
    }
    @media print { body { -webkit-print-color-adjust: exact; padding: 0; } }
    body {
      font-family: 'FangSong', 'SimSun', serif;
      font-size: 16pt;
      line-height: 28pt;
      color: #000;
      max-width: ${pageWidth}mm;
      margin: 0 auto;
      padding: ${pageLayout.margins.top}mm ${pageLayout.margins.right}mm ${pageLayout.margins.bottom}mm ${pageLayout.margins.left}mm;
    }
    .page {
      position: relative;
      box-sizing: border-box;
      min-height: ${pageHeight}mm;
      border: ${pageBorder};
      box-shadow: ${pageShadow};
      background: #fff;
      padding: ${pageLayout.margins.top}mm ${pageLayout.margins.right}mm ${pageLayout.margins.bottom}mm ${pageLayout.margins.left}mm;
    }
    .print-header {
      position: fixed;
      left: ${pageLayout.margins.left}mm;
      right: ${pageLayout.margins.right}mm;
      top: ${pageLayout.headerOffset}mm;
      color: #595959;
      font-size: 10.5pt;
      text-align: center;
    }
    .print-footer {
      position: fixed;
      left: ${pageLayout.margins.left}mm;
      right: ${pageLayout.margins.right}mm;
      bottom: ${pageLayout.footerOffset}mm;
      color: #595959;
      font-size: 10.5pt;
      text-align: center;
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
      color: ${pageLayout.watermark.color};
      opacity: ${pageLayout.watermark.opacity};
      font-size: 72pt;
      font-weight: 700;
      letter-spacing: 0.12em;
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
    th, td { padding: 4pt 8pt; text-align: center; font-size: 10.5pt; }
    img { max-width: 100%; height: auto; }
    .toc-block { margin: 18pt 0 24pt; }
    .toc-block h1 { margin-bottom: 18pt; }
    .toc-entry { text-indent: 0; margin: 4pt 0; display: flex; justify-content: space-between; gap: 16pt; }
    .toc-entry[data-toc-level="1"] { font-size: 16pt; }
    .toc-entry[data-toc-level="2"] { font-size: 14pt; }
    .toc-entry[data-toc-level="3"] { font-size: 12pt; }
    .toc-page-number { color: #595959; flex-shrink: 0; }
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
  </style>
</head>
<body>
  <div class="page">
    ${watermarkHtml}
    ${headerText ? `<div class="print-header">${escapeHtml(headerText)}</div>` : ''}
    ${footerText ? `<div class="print-footer">${escapeHtml(footerText)}</div>` : ''}
    <main class="document-body">
      <h1>${escapeHtml(normalizedDoc.title)}</h1>
      ${bodyHTML}
    </main>
  </div>
</body>
</html>`;
  }
}

function flattenFrameworkNodes(nodes: FrameworkNode[]): FrameworkNode[] {
  const result: FrameworkNode[] = [];
  for (const node of nodes) {
    result.push(node);
    result.push(...flattenFrameworkNodes(node.children));
  }
  return result;
}

function mmToTwip(value: number): number {
  return Math.round((value / 25.4) * 1440);
}

function getParagraphClass(node: any): string {
  return typeof node?.attrs?.class === 'string' ? node.attrs.class.trim() : '';
}

function mapTextAlign(value: unknown, AlignmentType: any): any {
  switch (value) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justify':
      return AlignmentType.JUSTIFIED;
    default:
      return undefined;
  }
}

function buildInlineRuns(inlines: any[], TextRun: any): any[] {
  return (inlines || []).map((inline: any) => {
    if (inline.type !== 'text') {
      return new TextRun({ text: '' });
    }

    const marks = inline.marks || [];
    return new TextRun({
      text: inline.text || '',
      bold: marks.some((mark: any) => mark.type === 'bold'),
      italics: marks.some((mark: any) => mark.type === 'italic'),
      underline: marks.some((mark: any) => mark.type === 'underline' || mark.type === 'link') ? { type: 'single' } : undefined,
      style: marks.some((mark: any) => mark.type === 'link') ? 'Hyperlink' : undefined,
      font: 'FangSong',
      size: 32,
    });
  });
}

function renderInlineHtml(inline: any): string {
  const marks = inline.marks || [];
  let content = escapeHtml(inline.text || '');

  if (marks.some((mark: any) => mark.type === 'bold')) {
    content = `<strong>${content}</strong>`;
  }

  if (marks.some((mark: any) => mark.type === 'italic')) {
    content = `<em>${content}</em>`;
  }

  if (marks.some((mark: any) => mark.type === 'underline')) {
    content = `<u>${content}</u>`;
  }

  const linkMark = marks.find((mark: any) => mark.type === 'link');
  if (linkMark?.attrs?.href) {
    content = `<a class="editor-link" href="${escapeHtml(String(linkMark.attrs.href))}">${content}</a>`;
  }

  return content;
}

function convertProseMirrorNode(node: any, mod: any): any {
  if (!node || !node.type) {
    return null;
  }

  const { AlignmentType, HeadingLevel, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = mod;

  if (node.type === 'tocBlock') {
    const title = String(node.attrs?.title || '目录');
    const withPageNumbers = Boolean(node.attrs?.withPageNumbers);
    const entries = Array.isArray(node.attrs?.entries) ? node.attrs.entries : [];

    return [
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 160 },
      }),
      ...entries.map((entry: any) => {
        const level = Math.min(Math.max(Number(entry?.level || 1), 1), 3);
        const label = String(entry?.label || '');
        const page = String(entry?.page || '');
        const prefix = '　'.repeat(Math.max(level - 1, 0));

        return new Paragraph({
          text: withPageNumbers && page ? `${prefix}${label} ${page}` : `${prefix}${label}`,
          spacing: { after: 80 },
        });
      }),
    ];
  }

  if (node.type === 'auxiliaryBlock') {
    const title = String(node.attrs?.title || 'Text Box');
    const body = String(node.attrs?.body || '');
    return new Paragraph({
      text: body ? `${title}: ${body}` : title,
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
    });
  }

  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level || 1;
      return new Paragraph({
        text: extractNodeText(node),
        heading: headingLevelFromNumber(level, HeadingLevel),
        spacing: { before: 240, after: 120 },
        ...(level === 1 ? { alignment: AlignmentType.CENTER } : {}),
      });
    }
    case 'paragraph': {
      const paragraphClass = getParagraphClass(node);
      const paragraphText = extractNodeText(node);

      if (paragraphClass === 'page-break') {
        return new Paragraph({
          pageBreakBefore: true,
          spacing: { before: 0, after: 0 },
        });
      }

      if (paragraphClass === 'page-number-field') {
        return new Paragraph({
          text: paragraphText || 'Page Number',
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
        });
      }

      if (paragraphClass === 'math-block') {
        return new Paragraph({
          text: paragraphText || 'Equation',
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
        });
      }

      const runs = buildInlineRuns(node.content || [], TextRun);

      const hasContent = runs.some((run: any) => run.options?.text);
      if (!hasContent) {
        return null;
      }

      return new Paragraph({
        children: runs,
        alignment: mapTextAlign(node.attrs?.textAlign, AlignmentType),
        spacing: { after: 120 },
      });
    }
    case 'table': {
      const rows = (node.content || []).map((row: any) => {
        const cells = (row.content || []).map((cell: any) => {
          const text = extractNodeText(cell);
          return new TableCell({
            children: [new Paragraph({ text, alignment: AlignmentType.CENTER })],
            width: { size: 100 / ((row.content || []).length || 1), type: WidthType.PERCENTAGE },
          });
        });
        return new TableRow({ children: cells });
      });

      return new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      });
    }
    case 'imagePlaceholder': {
      return new Paragraph({
        text: node.attrs?.caption || '[Image]',
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
      });
    }
    case 'image': {
      return new Paragraph({
        text: '[图片]',
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
      });
    }
    default:
      return null;
  }
}

function extractNodeText(node: any): string {
  if (!node) {
    return '';
  }
  if (node.type === 'text') {
    return node.text || '';
  }
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractNodeText).join('');
  }
  return '';
}

function headingLevelFromNumber(level: number, HeadingLevel: any): any {
  switch (level) {
    case 1:
      return HeadingLevel.HEADING_1;
    case 2:
      return HeadingLevel.HEADING_2;
    case 3:
      return HeadingLevel.HEADING_3;
    default:
      return HeadingLevel.HEADING_1;
  }
}

function proseMirrorNodeToHTML(node: any): string {
  if (!node || !node.type) {
    return '';
  }

  if (node.type === 'tocBlock') {
    const title = escapeHtml(String(node.attrs?.title || '目录'));
    const withPageNumbers = Boolean(node.attrs?.withPageNumbers);
    const entries = Array.isArray(node.attrs?.entries) ? node.attrs.entries : [];
    const entryHtml = entries
      .map((entry: any) => {
        const level = Math.min(Math.max(Number(entry?.level || 1), 1), 3);
        const label = escapeHtml(String(entry?.label || ''));
        const anchorId = escapeHtml(String(entry?.anchorId || ''));
        const page = escapeHtml(String(entry?.page || ''));
        const linkedLabel = anchorId
          ? `<a class="editor-link" href="#${anchorId}">${label}</a>`
          : label;
        return `<p class="toc-entry" data-toc-level="${level}" data-toc-target="${anchorId}"><span>${'&emsp;'.repeat(Math.max(level - 1, 0))}${linkedLabel}</span>${withPageNumbers ? `<span class="toc-page-number">${page}</span>` : ''}</p>`;
      })
      .join('');
    return `<section class="toc-block" data-generated="true" data-type="toc-block"><h1>${title}</h1><p>&nbsp;</p>${entryHtml}</section>`;
  }

  if (node.type === 'auxiliaryBlock') {
    const kind = escapeHtml(String(node.attrs?.kind || 'textBox'));
    const title = escapeHtml(String(node.attrs?.title || 'Text Box'));
    const body = escapeHtml(String(node.attrs?.body || ''));
    return `<section class="auxiliary-block auxiliary-block-${kind}" data-kind="${kind}"><header>${title}</header><div>${body || '&nbsp;'}</div></section>`;
  }

  switch (node.type) {
    case 'heading': {
      const level = Math.min(node.attrs?.level || 1, 3);
      return `<h${level}>${escapeHtml(extractNodeText(node))}</h${level}>`;
    }
    case 'paragraph': {
      const paragraphClass = getParagraphClass(node);
      const text = (node.content || [])
        .map((child: any) => {
          if (child.type !== 'text') {
            return '';
          }
          return renderInlineHtml(child);
        })
        .join('');

      if (paragraphClass === 'page-break') {
        return '<div class="page-break"></div>';
      }

      if (paragraphClass === 'page-number-field') {
        return `<p class="page-number-field">${escapeHtml(text || 'Page Number')}</p>`;
      }

      if (paragraphClass === 'math-block') {
        return `<p class="math-block">${escapeHtml(text || 'Equation')}</p>`;
      }

      return text.trim() ? `<p>${text}</p>` : '<p>&nbsp;</p>';
    }
    case 'table': {
      let html = '<table class="three-line-table"><tbody>';
      for (const row of node.content || []) {
        html += '<tr>';
        for (const cell of row.content || []) {
          html += `<td>${escapeHtml(extractNodeText(cell))}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
      return html;
    }
    case 'image': {
      const src = node.attrs?.src || '';
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(node.attrs?.alt || '')}" />`;
    }
    case 'imagePlaceholder': {
      const caption = escapeHtml(node.attrs?.caption || 'Image');
      const imageData = typeof node.attrs?.imageData === 'string' ? node.attrs.imageData : '';
      if (imageData) {
        return `<figure class="image-placeholder-print"><img src="${escapeHtml(imageData)}" alt="${caption}" /></figure>`;
      }
      return `<figure class="image-placeholder-print image-placeholder-empty"><div class="image-placeholder-box">${caption}</div></figure>`;
    }
    case 'text':
      return renderInlineHtml(node);
    default:
      return '';
  }
}

function convertHtmlToDocxChildren(html: string, mod: any): any[] {
  const { Paragraph } = mod;
  const body = extractBodyHtml(html);
  const children: any[] = [];
  const blockRegex = /<(h[1-3]|p|table|img|figure|div|section)\b([^>]*)>([\s\S]*?)<\/\1>|<(img)\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(body)) !== null) {
    const tagName = (match[1] || match[4] || '').toLowerCase();
    const attrs = parseHtmlAttributes(match[2] || match[5] || '');
    const inner = match[3] || '';

    if (tagName === 'img') {
      const converted = convertProseMirrorNode(
        {
          type: 'image',
          attrs: { src: attrs.src || '', alt: attrs.alt || '' },
        },
        mod
      );
      if (converted) {
        children.push(converted);
      }
      continue;
    }

    if (tagName === 'table') {
      const tableNode = htmlTableToPseudoNode(inner);
      const converted = convertProseMirrorNode(tableNode, mod);
      if (converted) {
        children.push(converted);
      }
      continue;
    }

    if (
      tagName === 'section' &&
      ((((attrs['data-type'] || '') as string) === 'toc-block') || (attrs.class || '').includes('toc-block'))
    ) {
      const titleMatch = inner.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
      const entryMatches = inner.matchAll(
        /<p\b[^>]*data-toc-level="([^"]+)"[^>]*data-toc-target="([^"]*)"[^>]*>([\s\S]*?)<\/p>/gi
      );
      const entries = Array.from(entryMatches).map((match) => {
        const level = Number.parseInt(match[1] || '1', 10) || 1;
        const anchorId = match[2] || '';
        const pageMatch = (match[3] || '').match(/<span\b[^>]*class="toc-page-number"[^>]*>([\s\S]*?)<\/span>/i);
        const page = Number.parseInt(htmlToPlainText(pageMatch?.[1] || ''), 10) || 0;
        const rawText = htmlToPlainText(match[3] || '');
        const label = page > 0 ? rawText.replace(new RegExp(`\\s*${page}\\s*$`), '').trim() : rawText.trim();

        return {
          level,
          label,
          anchorId,
          page: page || 1,
        };
      });

      const converted = convertProseMirrorNode(
        {
          type: 'tocBlock',
          attrs: {
            title: htmlToPlainText(titleMatch?.[1] || '目录'),
            withPageNumbers: entries.some((entry) => entry.page > 0),
            entries,
          },
        },
        mod
      );
      if (Array.isArray(converted)) {
        children.push(...converted);
      } else if (converted) {
        children.push(converted);
      }
      continue;
    }

    if (tagName === 'div' && (attrs.class || '').includes('page-break')) {
      const converted = convertProseMirrorNode(
        {
          type: 'paragraph',
          attrs: { class: 'page-break' },
        },
        mod
      );
      if (converted) {
        children.push(converted);
      }
      continue;
    }

    if (tagName === 'figure' && (attrs.class || '').includes('image-placeholder-print')) {
      const imageMatch = inner.match(/<img\b([^>]*)\/?>/i);
      const imageAttrs = imageMatch ? parseHtmlAttributes(imageMatch[1] || '') : {};
      const converted = convertProseMirrorNode(
        {
          type: 'imagePlaceholder',
          attrs: {
            caption: imageAttrs.alt || 'Image',
            imageData: imageAttrs.src || null,
          },
        },
        mod
      );
      if (converted) {
        children.push(converted);
      }
      continue;
    }

    if (tagName === 'section' && (attrs.class || '').includes('auxiliary-block')) {
      const titleMatch = inner.match(/<header\b[^>]*>([\s\S]*?)<\/header>/i);
      const bodyMatch = inner.match(/<div\b[^>]*>([\s\S]*?)<\/div>/i);
      const converted = convertProseMirrorNode(
        {
          type: 'auxiliaryBlock',
          attrs: {
            kind: attrs['data-kind'] || 'textBox',
            title: htmlToPlainText(titleMatch?.[1] || 'Text Box'),
            body: htmlToPlainText(bodyMatch?.[1] || ''),
          },
        },
        mod
      );
      if (converted) {
        children.push(converted);
      }
      continue;
    }

    const text = htmlToPlainText(inner);
    if (!text) {
      continue;
    }

    if (tagName.startsWith('h')) {
      const level = Number.parseInt(tagName.slice(1), 10) || 1;
      const converted = convertProseMirrorNode(
        {
          type: 'heading',
          attrs: { level },
          content: [{ type: 'text', text }],
        },
        mod
      );
      if (converted) {
        children.push(converted);
      }
      continue;
    }

    const converted = convertProseMirrorNode(
      {
        type: 'paragraph',
        attrs: {
          class:
            tagName === 'p' && (attrs.class || '').includes('page-number-field')
              ? 'page-number-field'
              : tagName === 'p' && (attrs.class || '').includes('math-block')
                ? 'math-block'
                : undefined,
        },
        content: [{ type: 'text', text }],
      },
      mod
    );
    if (converted) {
      children.push(converted);
    }
  }

  if (children.length === 0) {
    const fallbackText = htmlToPlainText(body);
    if (fallbackText) {
      children.push(
        new Paragraph({
          text: fallbackText,
          spacing: { after: 120 },
        })
      );
    }
  }

  return children;
}

function htmlTableToPseudoNode(html: string): any {
  const rows: any[] = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells: any[] = [];
    const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowMatch[1] || '')) !== null) {
      cells.push({
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: htmlToPlainText(cellMatch[1] || '') }],
          },
        ],
      });
    }

    if (cells.length > 0) {
      rows.push({ content: cells });
    }
  }

  return {
    type: 'table',
    content: rows,
  };
}

function extractBodyHtml(html: string): string {
  const mainMatch = html.match(/<main[^>]*class="document-body"[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch?.[1]) {
    return mainMatch[1];
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    return bodyMatch[1];
  }

  return html;
}

function htmlToPlainText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/h[1-3]>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  );
}

function parseHtmlAttributes(fragment: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9:-]+)\s*=\s*["']([^"']*)["']/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(fragment)) !== null) {
    attrs[match[1].toLowerCase()] = decodeHtmlEntities(match[2] || '');
  }

  return attrs;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const exportService = new ExportService();

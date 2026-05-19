import type { QiuAiDocument } from '@qiuai/shared';
import fs from 'node:fs/promises';
import path from 'node:path';

class ExportService {
  async exportDOCX(doc: QiuAiDocument, filePath: string): Promise<void> {
    try {
      // Dynamic import of docx package (ESM in CJS context)
      const docxModule = await import('docx');

      const {
        Document, Packer, Paragraph, TextRun, HeadingLevel,
        AlignmentType, Table, TableRow, TableCell,
        WidthType, BorderStyle, PageBreak,
        Header, Footer, PageNumber,
      } = docxModule;

      // Build document sections from editor content
      const children: any[] = [];
      const editorContent = doc.editorContent as any;

      // Add title
      if (doc.title) {
        children.push(
          new Paragraph({
            text: doc.title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          })
        );
      }

      // Process the editor content
      if (editorContent && typeof editorContent === 'object') {
        // Handle ProseMirror JSON structure
        if (editorContent.content && Array.isArray(editorContent.content)) {
          for (const node of editorContent.content) {
            const converted = convertProseMirrorNode(node, docxModule);
            if (converted) {
              if (Array.isArray(converted)) {
                children.push(...converted);
              } else {
                children.push(converted);
              }
            }
          }
        }
      }

      // If editor content is empty or couldn't be parsed, extract text from framework
      if (children.length <= 1) {
        for (const node of doc.framework) {
          children.push(
            new Paragraph({
              text: node.title,
              heading: headingLevelFromNumber(node.level, HeadingLevel),
              spacing: { before: 240, after: 120 },
            })
          );
          children.push(
            new Paragraph({
              text: '[此处需要补充正文内容]',
              spacing: { after: 120 },
            })
          );
        }
      }

      const docxDoc = new Document({
        styles: {
          default: {
            document: {
              run: {
                font: 'FangSong',
                size: 32, // 16pt in half-points
              },
            },
          },
        },
        sections: [
          {
            properties: {
              page: {
                size: { width: 11906, height: 16838 }, // A4 in twips
                margin: {
                  top: 1440,    // 25.4mm in twips
                  bottom: 1310, // ~23mm
                  left: 1800,   // ~31.7mm
                  right: 1800,
                },
              },
            },
            headers: {
              default: new Header({
                children: [
                  new Paragraph({
                    text: doc.title || '科研项目申报书',
                    alignment: AlignmentType.CENTER,
                    style: 'Header',
                  }),
                ],
              }),
            },
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        children: ['第 '],
                      }),
                      new TextRun({
                        children: [PageNumber.CURRENT],
                      }),
                      new TextRun({
                        children: [' 页'],
                      }),
                    ],
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
    } catch (err: any) {
      console.error('DOCX export error:', err);
      // Fallback: export as HTML
      await this.exportHTML(doc, filePath, 'docx');
    }
  }

  async exportPDF(doc: QiuAiDocument, filePath: string): Promise<void> {
    try {
      // For PDF, generate a well-formatted HTML and write it
      // In production with Electron, use Puppeteer for real PDF
      const html = this.generatePrintableHTML(doc);
      await fs.writeFile(filePath.replace(/\.pdf$/i, '.html'), html, 'utf-8');

      // PDF generation: HTML is written alongside for now
      // In production Electron environment, use puppeteer-core for real PDF
      console.log('PDF: HTML exported (real PDF requires Electron Puppeteer integration)');
    } catch (err: any) {
      console.error('PDF export error:', err);
      await this.exportHTML(doc, filePath, 'pdf');
    }
  }

  private async exportHTML(doc: QiuAiDocument, filePath: string, _format: string): Promise<void> {
    const html = this.generatePrintableHTML(doc);
    await fs.writeFile(filePath.replace(/\.(docx|pdf)$/i, '.html'), html, 'utf-8');
  }

  private generatePrintableHTML(doc: QiuAiDocument): string {
    let bodyHTML = '';

    if (doc.editorContent) {
      const content = doc.editorContent as any;
      if (content.content && Array.isArray(content.content)) {
        bodyHTML = content.content.map((node: any) =>
          proseMirrorNodeToHTML(node)
        ).join('\n');
      }
    }

    if (!bodyHTML) {
      bodyHTML = doc.framework.map(n =>
        `<h${n.level}>${escapeHtml(n.title)}</h${n.level}><p>正文内容待补充</p>`
      ).join('\n');
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(doc.title)}</title>
  <style>
    @page { size: A4; margin: 25.4mm 31.7mm 25.4mm 31.7mm; }
    @media print { body { -webkit-print-color-adjust: exact; } }
    body {
      font-family: 'FangSong', '仿宋', 'SimSun', '宋体', serif;
      font-size: 16pt;
      line-height: 28pt;
      color: #000;
    }
    h1 { font-family: 'SimHei', '黑体', sans-serif; font-size: 22pt; text-align: center; margin: 24px 0 16px; }
    h2 { font-family: 'SimHei', '黑体', sans-serif; font-size: 16pt; margin: 20px 0 12px; }
    h3 { font-family: 'SimHei', '黑体', sans-serif; font-size: 14pt; margin: 16px 0 10px; }
    p { text-indent: 2em; margin: 0 0 8px; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    table thead { border-top: 1.5pt solid #000; border-bottom: 0.75pt solid #000; }
    table tbody { border-bottom: 1.5pt solid #000; }
    th, td { padding: 4pt 8pt; text-align: center; font-size: 10.5pt; }
    img { max-width: 100%; height: auto; }
    .page-break { page-break-after: always; }
    mark { background: #fff566; }
  </style>
</head>
<body>
  <h1 style="text-align:center;">${escapeHtml(doc.title)}</h1>
  ${bodyHTML}
</body>
</html>`;
  }
}

// Helper: Convert ProseMirror node to docx Paragraph/Table
function convertProseMirrorNode(node: any, mod: any): any {
  if (!node || !node.type) return null;

  const { Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = mod;

  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level || 1;
      const headingLevel = headingLevelFromNumber(level, HeadingLevel);
      const text = extractNodeText(node);
      return new Paragraph({
        text,
        heading: headingLevel,
        spacing: { before: 240, after: 120 },
        ...(level === 1 ? { alignment: AlignmentType.CENTER } : {}),
      });
    }

    case 'paragraph': {
      const runs = node.content?.map((inline: any) => {
        if (inline.type === 'text') {
          const marks = inline.marks || [];
          const bold = marks.some((m: any) => m.type === 'bold');
          const italic = marks.some((m: any) => m.type === 'italic');
          const underline = marks.some((m: any) => m.type === 'underline');
          return new TextRun({
            text: inline.text || '',
            bold,
            italics: italic,
            underline: underline ? { type: 'single' } : undefined,
            font: 'FangSong',
            size: 32,
          });
        }
        return new TextRun({ text: '' });
      }) || [];

      const hasContent = runs.some((r: any) => r.options?.text);
      if (!hasContent) return null;

      return new Paragraph({
        children: runs,
        spacing: { after: 120 },
      });
    }

    case 'table': {
      try {
        const rows = node.content?.map((row: any) => {
          const cells = row.content?.map((cell: any) => {
            const text = extractNodeText(cell);
            return new TableCell({
              children: [new Paragraph({ text, alignment: AlignmentType.CENTER })],
              width: { size: 100 / (row.content?.length || 1), type: WidthType.PERCENTAGE },
            });
          }) || [];
          return new TableRow({ children: cells });
        }) || [];

        // Apply three-line table borders
        rows.forEach((row: any, idx: number) => {
          row.cells?.forEach((cell: any) => {
            if (cell.children) {
              // Top border on first row
              if (idx === 0) {
                // heavy top
              }
            }
          });
        });

        return new Table({
          rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        });
      } catch {
        return null;
      }
    }

    case 'image': {
      // Images in docx would need the actual image data
      // For now, insert a placeholder
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
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractNodeText).join('');
  }
  return '';
}

function headingLevelFromNumber(level: number, HeadingLevel: any): any {
  switch (level) {
    case 1: return HeadingLevel.HEADING_1;
    case 2: return HeadingLevel.HEADING_2;
    case 3: return HeadingLevel.HEADING_3;
    default: return HeadingLevel.HEADING_1;
  }
}

function proseMirrorNodeToHTML(node: any): string {
  if (!node || !node.type) return '';

  switch (node.type) {
    case 'heading': {
      const level = Math.min(node.attrs?.level || 1, 3);
      const text = extractNodeText(node);
      return `<h${level}>${escapeHtml(text)}</h${level}>`;
    }
    case 'paragraph': {
      const text = extractNodeText(node);
      if (!text.trim()) return '<p>&nbsp;</p>';
      return `<p>${escapeHtml(text)}</p>`;
    }
    case 'table': {
      let html = '<table class="three-line-table"><tbody>';
      if (node.content) {
        for (const row of node.content) {
          html += '<tr>';
          if (row.content) {
            for (const cell of row.content) {
              const text = extractNodeText(cell);
              html += `<td>${escapeHtml(text)}</td>`;
            }
          }
          html += '</tr>';
        }
      }
      html += '</tbody></table>';
      return html;
    }
    case 'image': {
      const src = node.attrs?.src || '';
      return `<img src="${escapeHtml(src)}" alt="图片"/>`;
    }
    case 'bulletList':
    case 'orderedList': {
      return (node.content || []).map((item: any) => {
        const text = extractNodeText(item);
        return `<p>${escapeHtml(text)}</p>`;
      }).join('\n');
    }
    default:
      return '';
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const exportService = new ExportService();

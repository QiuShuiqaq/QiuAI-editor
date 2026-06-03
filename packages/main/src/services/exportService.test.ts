import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createEmptyDocumentState, generateId, syncDocumentWithState, type FrameworkNode, WritingPhase } from '@qiuai/shared';
import { exportService } from './exportService';

function readZipEntry(buffer: Buffer, entryName: string): Buffer {
  const eocdSignature = 0x06054b50;
  const centralDirectorySignature = 0x02014b50;
  const localFileHeaderSignature = 0x04034b50;
  const eocdOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));

  if (eocdOffset < 0) {
    throw new Error('EOCD not found');
  }

  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(cursor) !== centralDirectorySignature) {
      throw new Error('Invalid central directory entry');
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer.toString('utf8', cursor + 46, cursor + 46 + fileNameLength);

    if (fileName === entryName) {
      if (buffer.readUInt32LE(localHeaderOffset) !== localFileHeaderSignature) {
        throw new Error('Invalid local file header');
      }

      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) {
        return compressed;
      }

      if (compressionMethod === 8) {
        return zlib.inflateRawSync(compressed);
      }

      throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error(`ZIP entry not found: ${entryName}`);
}

function hasZipEntry(buffer: Buffer, entryName: string): boolean {
  try {
    readZipEntry(buffer, entryName);
    return true;
  } catch {
    return false;
  }
}

describe('exportService framework fallback', () => {
  it('renders nested outline nodes into fallback printable html in order', () => {
    const framework: FrameworkNode[] = [
      {
        id: '1',
        title: '一、人工智能概述',
        level: 1,
        order: 1,
        needsImage: false,
        needsTable: false,
        dataKeywords: [],
        children: [
          {
            id: '1-1',
            title: '（一）人工智能定义',
            level: 2,
            order: 1,
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
        ],
      },
      {
        id: '2',
        title: '四、人工智能核心技术体系',
        level: 1,
        order: 2,
        needsImage: false,
        needsTable: false,
        dataKeywords: [],
        children: [
          {
            id: '2-1',
            title: '（四）多模态生成技术',
            level: 2,
            order: 1,
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
            children: [
              {
                id: '2-1-1',
                title: '2. AIGC全链路创作技术',
                level: 3,
                order: 2,
                needsImage: false,
                needsTable: false,
                dataKeywords: [],
                children: [
                  {
                    id: '2-1-1-1',
                    title: '（1）AI写作技术',
                    level: 3,
                    order: 1,
                    needsImage: false,
                    needsTable: false,
                    dataKeywords: [],
                    children: [],
                  },
                  {
                    id: '2-1-1-2',
                    title: '（2）AI论文辅助技术',
                    level: 3,
                    order: 2,
                    needsImage: false,
                    needsTable: false,
                    dataKeywords: [],
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const now = new Date().toISOString();
    const doc = syncDocumentWithState({
      id: generateId(),
      title: '人工智能项目报告',
      createdAt: now,
      updatedAt: now,
      currentPhase: WritingPhase.FRAMEWORK,
      framework,
      slotAssignments: {},
      editorContent: {},
      referenceMaterials: [],
      documentPlan: '',
      documentState: createEmptyDocumentState(),
    });

    const html = exportService.generateDebugPrintableHTML(doc);

    expect(html).toContain('一、人工智能概述');
    expect(html).toContain('（一）人工智能定义');
    expect(html).toContain('四、人工智能核心技术体系');
    expect(html).toContain('（四）多模态生成技术');
    expect(html).toContain('2. AIGC全链路创作技术');
    expect(html).toContain('（1）AI写作技术');
    expect(html).toContain('（2）AI论文辅助技术');

    expect(html.indexOf('2. AIGC全链路创作技术')).toBeLessThan(html.indexOf('（1）AI写作技术'));
    expect(html.indexOf('（1）AI写作技术')).toBeLessThan(html.indexOf('（2）AI论文辅助技术'));
  });

  it('renders editor content paragraphs and headings into printable html', () => {
    const now = new Date().toISOString();
    const doc = syncDocumentWithState({
      id: generateId(),
      title: '导出正文验证',
      createdAt: now,
      updatedAt: now,
      currentPhase: WritingPhase.TEXT_GEN,
      framework: [],
      slotAssignments: {},
      editorContent: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: '一、研究背景' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '这是第一段正文内容。' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '这是第二段正文内容。' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '（一）关键问题' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '这里是第三段正文，用于验证导出不会只剩第一行。' }],
          },
        ],
      },
      referenceMaterials: [],
      documentPlan: '',
      documentState: createEmptyDocumentState(),
    });

    const html = exportService.generateDebugPrintableHTML(doc);

    expect(html).toContain('<h1>一、研究背景</h1>');
    expect(html).toContain('<p>这是第一段正文内容。</p>');
    expect(html).toContain('<p>这是第二段正文内容。</p>');
    expect(html).toContain('<h2>（一）关键问题</h2>');
    expect(html).toContain('<p>这里是第三段正文，用于验证导出不会只剩第一行。</p>');
    expect(html.indexOf('这是第一段正文内容。')).toBeLessThan(html.indexOf('这是第二段正文内容。'));
    expect(html.indexOf('这是第二段正文内容。')).toBeLessThan(
      html.indexOf('这里是第三段正文，用于验证导出不会只剩第一行。')
    );
  });
  it('renders structured blocks for page fields and placeholders', () => {
    const now = new Date().toISOString();
    const doc = syncDocumentWithState({
      id: generateId(),
      title: 'Structured Block Export',
      createdAt: now,
      updatedAt: now,
      currentPhase: WritingPhase.TEXT_GEN,
      framework: [],
      slotAssignments: {},
      editorContent: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { class: 'page-number-field' },
            content: [{ type: 'text', text: 'Page Number' }],
          },
          {
            type: 'paragraph',
            attrs: { class: 'math-block' },
            content: [{ type: 'text', text: 'Equation: y = ax + b' }],
          },
          {
            type: 'imagePlaceholder',
            attrs: {
              caption: 'Architecture Diagram',
              imageData: 'data:image/png;base64,abc123',
            },
          },
          {
            type: 'paragraph',
            attrs: { class: 'page-break' },
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Next page content' }],
          },
        ],
      },
      referenceMaterials: [],
      documentPlan: '',
      documentState: createEmptyDocumentState(),
    });

    const html = exportService.generateDebugPrintableHTML(doc);

    expect(html).toContain('<p class="page-number-field">Page Number</p>');
    expect(html).toContain('<p class="math-block">Equation: y = ax + b</p>');
    expect(html).toContain('class="image-placeholder-print"');
    expect(html).toContain('Architecture Diagram');
    expect(html).toContain('<div class="page-break"></div>');
    expect(html).toContain('<p>Next page content</p>');
  });

  it('preserves hyperlink marks in printable html export', () => {
    const now = new Date().toISOString();
    const doc = syncDocumentWithState({
      id: generateId(),
      title: 'Link Export',
      createdAt: now,
      updatedAt: now,
      currentPhase: WritingPhase.TEXT_GEN,
      framework: [],
      slotAssignments: {},
      editorContent: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'See ' },
              {
                type: 'text',
                text: 'Section 1.1',
                marks: [{ type: 'link', attrs: { href: '#heading-anchor-section-1-1' } }],
              },
              { type: 'text', text: ' for details.' },
            ],
          },
        ],
      },
      referenceMaterials: [],
      documentPlan: '',
      documentState: createEmptyDocumentState(),
    });

    const html = exportService.generateDebugPrintableHTML(doc);

    expect(html).toContain('href="#heading-anchor-section-1-1"');
    expect(html).toContain('<a class="editor-link" href="#heading-anchor-section-1-1">Section 1.1</a>');
  });

  it('renders auxiliary blocks in printable html export', () => {
    const now = new Date().toISOString();
    const doc = syncDocumentWithState({
      id: generateId(),
      title: 'Auxiliary Block Export',
      createdAt: now,
      updatedAt: now,
      currentPhase: WritingPhase.TEXT_GEN,
      framework: [],
      slotAssignments: {},
      editorContent: {
        type: 'doc',
        content: [
          {
            type: 'auxiliaryBlock',
            attrs: {
              kind: 'chart',
              title: '图表',
              body: '统计占位内容',
            },
          },
        ],
      },
      referenceMaterials: [],
      documentPlan: '',
      documentState: createEmptyDocumentState(),
    });

    const html = exportService.generateDebugPrintableHTML(doc);

    expect(html).toContain('auxiliary-block-chart');
    expect(html).toContain('图表');
    expect(html).toContain('统计占位内容');
  });
  it('renders toc blocks in printable html export', () => {
    const now = new Date().toISOString();
    const doc = syncDocumentWithState({
      id: generateId(),
      title: 'TOC Export',
      createdAt: now,
      updatedAt: now,
      currentPhase: WritingPhase.TEXT_GEN,
      framework: [],
      slotAssignments: {},
      editorContent: {
        type: 'doc',
        content: [
          {
            type: 'tocBlock',
            attrs: {
              title: '目录',
              withPageNumbers: true,
              entries: [
                { level: 1, label: '一、人工智能概述', anchorId: 'heading-1', page: '1' },
                { level: 2, label: '（一）人工智能定义', anchorId: 'heading-1-1', page: '2' },
              ],
            },
          },
        ],
      },
      referenceMaterials: [],
      documentPlan: '',
      documentState: createEmptyDocumentState(),
    });

    const html = exportService.generateDebugPrintableHTML(doc);

    expect(html).toContain('class="toc-block"');
    expect(html).toContain('data-type="toc-block"');
    expect(html).toContain('class="toc-entry"');
    expect(html).toContain('class="toc-page-number">1</span>');
    expect(html).toContain('href="#heading-1"');
    expect(html).toContain('一、人工智能概述');
    expect(html).toContain('（一）人工智能定义');
  });
  it('writes a real docx file for editor content export', async () => {
    const now = new Date().toISOString();
    const doc = syncDocumentWithState({
      id: generateId(),
      title: 'DOCX Export Smoke Test',
      createdAt: now,
      updatedAt: now,
      currentPhase: WritingPhase.TEXT_GEN,
      framework: [],
      slotAssignments: {},
      editorContent: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: '一、研究背景' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '（一）问题提出' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '这里是一段用于 DOCX 导出的正文。' }],
          },
        ],
      },
      referenceMaterials: [],
      documentPlan: '',
      documentState: createEmptyDocumentState(),
    });

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuai-export-'));
    const outputPath = path.join(tempDir, 'paper.docx');

    try {
      await exportService.exportDOCX(doc, outputPath);

      const buffer = await fs.readFile(outputPath);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.subarray(0, 2).toString()).toBe('PK');
      const documentXml = readZipEntry(buffer, 'word/document.xml').toString('utf8');
      expect(documentXml).toContain('DOCX Export Smoke Test');
      expect(documentXml).toContain('这里是一段用于 DOCX 导出的正文。');
      expect(documentXml).toContain('一、研究背景');
      expect(documentXml).toContain('（一）问题提出');
      expect(documentXml).not.toContain('Heading1');
      expect(documentXml).not.toContain('Heading2');
      expect(documentXml).toContain('w:color w:val="000000"');
      expect(documentXml).toContain('SimHei');
      expect(hasZipEntry(buffer, 'word/header1.xml')).toBe(false);
      expect(hasZipEntry(buffer, 'word/footer1.xml')).toBe(false);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('prefers inline authoring html when building export output', () => {
    const framework: FrameworkNode[] = [
      {
        id: '1',
        title: '仅有大纲',
        level: 1,
        order: 1,
        needsImage: false,
        needsTable: false,
        dataKeywords: [],
        children: [],
      },
    ];
    const now = new Date().toISOString();
    const doc = syncDocumentWithState({
      id: generateId(),
      title: 'Inline HTML Export',
      createdAt: now,
      updatedAt: now,
      currentPhase: WritingPhase.TEXT_GEN,
      framework,
      slotAssignments: {},
      editorContent: {},
      referenceMaterials: [],
      documentPlan: '',
      documentState: createEmptyDocumentState(),
    });

    const html = exportService.generateDebugPrintableHTML(
      doc,
      '<h1>一、研究背景</h1><p>这里是导出时优先采用的正文内容。</p><p>第二段正文也应该出现在 Word 中。</p>'
    );

    expect(html).toContain('这里是导出时优先采用的正文内容。');
    expect(html).toContain('第二段正文也应该出现在 Word 中。');
    expect(html).not.toContain('正文内容待补充');
  });

  it('writes a real docx file for a structured paper sample with placeholders', async () => {
    const now = new Date().toISOString();
    const doc = syncDocumentWithState({
      id: generateId(),
      title: 'Structured Paper Sample',
      createdAt: now,
      updatedAt: now,
      currentPhase: WritingPhase.TEXT_GEN,
      framework: [],
      slotAssignments: {},
      editorContent: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: '一、研究目标' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '本文围绕论文 Agent 的稳定生成与导出能力展开验证。' }],
          },
          {
            type: 'table',
            content: [
              {
                content: [
                  { content: [{ type: 'paragraph', content: [{ type: 'text', text: '指标' }] }] },
                  { content: [{ type: 'paragraph', content: [{ type: 'text', text: '结果' }] }] },
                ],
              },
              {
                content: [
                  { content: [{ type: 'paragraph', content: [{ type: 'text', text: '导出成功率' }] }] },
                  { content: [{ type: 'paragraph', content: [{ type: 'text', text: '100%' }] }] },
                ],
              },
            ],
          },
          {
            type: 'imagePlaceholder',
            attrs: {
              caption: '系统结构图',
              imageData: 'data:image/png;base64,abc123',
            },
          },
          {
            type: 'tocBlock',
            attrs: {
              title: '目录',
              withPageNumbers: true,
              entries: [{ level: 1, label: '一、研究目标', anchorId: 'heading-1', page: '1' }],
            },
          },
        ],
      },
      referenceMaterials: [],
      documentPlan: '',
      documentState: createEmptyDocumentState(),
    });

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuai-export-structured-'));
    const outputPath = path.join(tempDir, 'structured-paper.docx');

    try {
      await exportService.exportDOCX(doc, outputPath);

      const buffer = await fs.readFile(outputPath);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.subarray(0, 2).toString()).toBe('PK');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('writes a real docx file for a paper template style sample with metadata and references', async () => {
    const now = new Date().toISOString();
    const doc = syncDocumentWithState({
      id: generateId(),
      title: '论文模板导出样例',
      createdAt: now,
      updatedAt: now,
      currentPhase: WritingPhase.TEXT_GEN,
      framework: [],
      slotAssignments: {},
      editorContent: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: '摘要' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '本文围绕论文写作 Agent 的稳定生成、修改与导出能力展开说明。' }],
          },
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: '关键词' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '论文写作；智能体；Word 导出；稳定性' }],
          },
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: '参考文献' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '[1] OpenAI. Agent authoring systems report.' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '[2] DeepSeek. Long-form writing API notes.' }],
          },
        ],
      },
      referenceMaterials: [],
      documentPlan: '',
      documentState: {
        ...createEmptyDocumentState(),
        documentMeta: {
          author: 'QiuAI Team',
          subject: 'Paper Agent Export',
          keywords: ['agent', 'paper', 'docx'],
        },
        pageLayout: {
          ...createEmptyDocumentState().pageLayout,
          headerText: '论文模板导出样例',
          footerText: '第 [页码] 页',
          differentFirstPage: true,
        },
      },
    });

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuai-export-template-'));
    const outputPath = path.join(tempDir, 'paper-template.docx');

    try {
      await exportService.exportDOCX(doc, outputPath);

      const buffer = await fs.readFile(outputPath);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.subarray(0, 2).toString()).toBe('PK');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});

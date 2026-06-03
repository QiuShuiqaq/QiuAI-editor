import { describe, expect, it } from 'vitest';
import { createEmptyDocumentState, generateId, syncDocumentWithState, type FrameworkNode, WritingPhase } from '@qiuai/shared';
import { exportService } from './exportService';

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
});

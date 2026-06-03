import { describe, expect, it } from 'vitest';
import {
  createEmptyDocumentState,
  hasMeaningfulEditorContent,
  syncDocumentWithState,
  type QiuAiDocument,
  WritingPhase,
} from './index';

function createDoc(overrides: Partial<QiuAiDocument>): QiuAiDocument {
  const now = new Date().toISOString();
  return {
    id: 'doc-test',
    title: '测试文档',
    createdAt: now,
    updatedAt: now,
    currentPhase: WritingPhase.FRAMEWORK,
    framework: [],
    slotAssignments: {},
    editorContent: {},
    referenceMaterials: [],
    documentPlan: '',
    documentState: createEmptyDocumentState(),
    ...overrides,
  };
}

describe('hasMeaningfulEditorContent', () => {
  it('treats empty doc shells as no editor body', () => {
    expect(hasMeaningfulEditorContent({})).toBe(false);
    expect(hasMeaningfulEditorContent({ type: 'doc', content: [] })).toBe(false);
    expect(
      hasMeaningfulEditorContent({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      })
    ).toBe(false);
    expect(
      hasMeaningfulEditorContent({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '   ' }] }],
      })
    ).toBe(false);
  });

  it('detects real paragraph, image, and table content', () => {
    expect(
      hasMeaningfulEditorContent({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '正文内容' }] }],
      })
    ).toBe(true);
    expect(
      hasMeaningfulEditorContent({
        type: 'doc',
        content: [{ type: 'image', attrs: { src: 'data:image/png;base64,abc' } }],
      })
    ).toBe(true);
    expect(
      hasMeaningfulEditorContent({
        type: 'doc',
        content: [{ type: 'table', content: [] }],
      })
    ).toBe(true);
  });
});

describe('syncDocumentWithState', () => {
  it('does not let empty editor shells block framework-based content flows', () => {
    const synced = syncDocumentWithState(
      createDoc({
        framework: [
          {
            id: 'section-1',
            title: '一、研究背景',
            level: 1,
            order: 1,
            children: [],
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
          },
        ],
        editorContent: {
          type: 'doc',
          content: [{ type: 'paragraph' }],
        },
      })
    );

    expect(synced.editorContent).toEqual({});
    expect(synced.documentState.editorContent).toEqual({});
    expect(synced.framework).toHaveLength(1);
  });
});

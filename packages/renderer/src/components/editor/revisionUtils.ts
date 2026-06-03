import type { JSONContent } from '@tiptap/core';
import type { Mark as ProseMirrorMark, Node as ProseMirrorNode } from 'prosemirror-model';

export type RevisionKind = 'insert' | 'delete';

export interface RevisionItem {
  id: string;
  kind: RevisionKind;
  text: string;
  createdAt: string | null;
}

function collectText(node: JSONContent | undefined): string {
  if (!node) return '';
  if (typeof node.text === 'string') {
    return node.text;
  }
  return (node.content ?? []).map((child) => collectText(child)).join('');
}

export function extractRevisionItems(content: Record<string, unknown> | null | undefined): RevisionItem[] {
  if (!content || typeof content !== 'object') {
    return [];
  }

  const root = content as JSONContent;
  const items: RevisionItem[] = [];

  const walk = (node: JSONContent | undefined) => {
    if (!node) return;

    if (node.marks?.length && typeof node.text === 'string') {
      for (const mark of node.marks) {
        if (mark.type !== 'revisionMark') {
          continue;
        }

        const revisionId = typeof mark.attrs?.revisionId === 'string' ? mark.attrs.revisionId : '';
        if (!revisionId) {
          continue;
        }

        const existing = items.find((item) => item.id === revisionId);
        const text = node.text ?? '';
        const kind = mark.attrs?.revisionKind === 'delete' ? 'delete' : 'insert';
        const createdAt = typeof mark.attrs?.createdAt === 'string' ? mark.attrs.createdAt : null;

        if (existing) {
          existing.text += text;
        } else {
          items.push({
            id: revisionId,
            kind,
            text,
            createdAt,
          });
        }
      }
    }

    for (const child of node.content ?? []) {
      walk(child);
    }
  };

  walk(root);

  return items.filter((item) => item.text.trim().length > 0);
}

export function summarizeRevisionCounts(items: RevisionItem[]) {
  return items.reduce(
    (summary, item) => {
      if (item.kind === 'insert') {
        summary.inserts += 1;
      } else {
        summary.deletes += 1;
      }
      return summary;
    },
    { inserts: 0, deletes: 0 }
  );
}

export function getRevisionPreviewText(item: RevisionItem) {
  const normalized = item.text.replace(/\s+/g, ' ').trim();
  return normalized.length > 36 ? `${normalized.slice(0, 36)}...` : normalized;
}

export function getRevisionRangeById(doc: ProseMirrorNode, revisionId: string): { from: number; to: number } | null {
  let start: number | null = null;
  let end: number | null = null;

  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (!node.isText) {
      return;
    }

    const hasRevision = node.marks.some(
      (mark: ProseMirrorMark) => mark.type.name === 'revisionMark' && mark.attrs.revisionId === revisionId
    );

    if (!hasRevision) {
      return;
    }

    if (start === null) {
      start = pos;
    }
    end = pos + node.nodeSize;
  });

  if (start === null || end === null || start >= end) {
    return null;
  }

  return { from: start, to: end };
}

export function getRevisionPlainText(content: Record<string, unknown> | null | undefined) {
  return collectText(content as JSONContent);
}

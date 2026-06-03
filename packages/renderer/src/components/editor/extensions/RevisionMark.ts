import { Mark, mergeAttributes } from '@tiptap/core';
import type { Mark as ProseMirrorMark, Node as ProseMirrorNode } from 'prosemirror-model';

export type RevisionKind = 'insert' | 'delete';

export interface RevisionAttrs {
  revisionId: string | null;
  revisionKind: RevisionKind;
  createdAt: string | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    revisionMark: {
      setRevisionMark: (attrs: RevisionAttrs) => ReturnType;
      unsetRevisionMark: () => ReturnType;
      acceptRevisionAtSelection: () => ReturnType;
      rejectRevisionAtSelection: () => ReturnType;
      acceptAllRevisions: () => ReturnType;
      rejectAllRevisions: () => ReturnType;
    };
  }
}

function getRevisionRange(
  doc: ProseMirrorNode,
  pos: number,
  markTypeName: string
) {
  const $pos = doc.resolve(pos);
  const parent = $pos.parent;
  const offset = $pos.parentOffset;
  let start = $pos.start();
  let end = start;
  let found = false;

  parent.forEach((node: ProseMirrorNode, nodeOffset: number) => {
    const hasMark = node.marks.some((mark: ProseMirrorMark) => mark.type.name === markTypeName);
    if (!hasMark) {
      return;
    }

    const nodeStart = $pos.start() + nodeOffset;
    const nodeEnd = nodeStart + node.nodeSize;
    if (offset >= nodeOffset && offset <= nodeOffset + node.nodeSize) {
      start = nodeStart;
      end = nodeEnd;
      found = true;
    }
  });

  return found ? { start, end } : null;
}

export const RevisionMark = Mark.create({
  name: 'revisionMark',

  inclusive: false,

  addAttributes() {
    return {
      revisionId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-revision-id'),
      },
      revisionKind: {
        default: 'insert',
        parseHTML: (element) => element.getAttribute('data-revision-kind') ?? 'insert',
      },
      createdAt: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-created-at'),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'mark[data-type="review-revision"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const revisionKind =
      typeof HTMLAttributes.revisionKind === 'string' ? HTMLAttributes.revisionKind : 'insert';

    return [
      'mark',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'review-revision',
        'data-revision-id': HTMLAttributes.revisionId,
        'data-revision-kind': revisionKind,
        'data-created-at': HTMLAttributes.createdAt,
        class: revisionKind === 'delete' ? 'revision-mark revision-mark-delete' : 'revision-mark revision-mark-insert',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setRevisionMark:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),

      unsetRevisionMark:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),

      acceptRevisionAtSelection:
        () =>
        ({ state, tr, dispatch }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) return false;
          const range = getRevisionRange(state.doc, state.selection.from, this.name);
          if (!range) return false;

          const { start, end } = range;
          const marks = state.doc.resolve(start).marksAcross(state.doc.resolve(end)) ?? [];
          const revisionMark = marks.find((mark) => mark.type === markType);
          if (!revisionMark) return false;

          if (revisionMark.attrs.revisionKind === 'delete') {
            tr.delete(start, end);
          } else {
            tr.removeMark(start, end, markType);
          }

          if (dispatch) {
            dispatch(tr);
          }
          return true;
        },

      rejectRevisionAtSelection:
        () =>
        ({ state, tr, dispatch }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) return false;
          const range = getRevisionRange(state.doc, state.selection.from, this.name);
          if (!range) return false;

          const { start, end } = range;
          const marks = state.doc.resolve(start).marksAcross(state.doc.resolve(end)) ?? [];
          const revisionMark = marks.find((mark) => mark.type === markType);
          if (!revisionMark) return false;

          if (revisionMark.attrs.revisionKind === 'insert') {
            tr.delete(start, end);
          } else {
            tr.removeMark(start, end, markType);
          }

          if (dispatch) {
            dispatch(tr);
          }
          return true;
        },

      acceptAllRevisions:
        () =>
        ({ state, tr, dispatch }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) return false;

          const deletions: Array<{ from: number; to: number }> = [];
          const insertions: Array<{ from: number; to: number }> = [];

          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            const revisionMark = node.marks.find((mark) => mark.type === markType);
            if (!revisionMark) return;

            if (revisionMark.attrs.revisionKind === 'delete') {
              deletions.push({ from: pos, to: pos + node.nodeSize });
            } else {
              insertions.push({ from: pos, to: pos + node.nodeSize });
            }
          });

          for (const range of [...deletions].reverse()) {
            tr.delete(range.from, range.to);
          }

          for (const range of insertions) {
            tr.removeMark(range.from, range.to, markType);
          }

          if (dispatch) {
            dispatch(tr);
          }
          return true;
        },

      rejectAllRevisions:
        () =>
        ({ state, tr, dispatch }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) return false;

          const deletions: Array<{ from: number; to: number }> = [];
          const keepDeletes: Array<{ from: number; to: number }> = [];

          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            const revisionMark = node.marks.find((mark) => mark.type === markType);
            if (!revisionMark) return;

            if (revisionMark.attrs.revisionKind === 'insert') {
              deletions.push({ from: pos, to: pos + node.nodeSize });
            } else {
              keepDeletes.push({ from: pos, to: pos + node.nodeSize });
            }
          });

          for (const range of [...deletions].reverse()) {
            tr.delete(range.from, range.to);
          }

          for (const range of keepDeletes) {
            tr.removeMark(range.from, range.to, markType);
          }

          if (dispatch) {
            dispatch(tr);
          }
          return true;
        },
    };
  },
});

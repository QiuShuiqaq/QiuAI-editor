import { Node, mergeAttributes } from '@tiptap/core';

export type AuxiliaryBlockKind = 'textBox' | 'shape' | 'chart';

export interface AuxiliaryBlockOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    auxiliaryBlock: {
      insertAuxiliaryBlock: (attrs: {
        kind: AuxiliaryBlockKind;
        title: string;
        body?: string;
      }) => ReturnType;
    };
  }
}

function getDefaultBody(kind: AuxiliaryBlockKind): string {
  if (kind === 'shape') return '形状占位';
  if (kind === 'chart') return '图表占位';
  return '文本框占位';
}

export const AuxiliaryBlock = Node.create<AuxiliaryBlockOptions>({
  name: 'auxiliaryBlock',

  group: 'block',

  atom: true,

  selectable: true,

  addAttributes() {
    return {
      kind: { default: 'textBox' },
      title: { default: '文本框' },
      body: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="auxiliary-block"]' }];
  },

  renderHTML({ node }) {
    const kind = (node.attrs.kind as AuxiliaryBlockKind) || 'textBox';
    const title = String(node.attrs.title ?? '文本框');
    const body = String(node.attrs.body ?? '') || getDefaultBody(kind);

    return [
      'div',
      mergeAttributes({
        'data-type': 'auxiliary-block',
        'data-kind': kind,
        class: `auxiliary-block auxiliary-block-${kind}`,
        contenteditable: 'false',
      }),
      ['div', { class: 'auxiliary-block-title' }, title],
      ['div', { class: 'auxiliary-block-body' }, body],
    ];
  },

  addCommands() {
    return {
      insertAuxiliaryBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});

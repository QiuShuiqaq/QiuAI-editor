import { Node } from '@tiptap/core';

interface TocEntry {
  level: number;
  label: string;
  anchorId: string;
  page: number;
}

export interface TocBlockOptions {
  HTMLAttributes: Record<string, unknown>;
}

export const TocBlock = Node.create<TocBlockOptions>({
  name: 'tocBlock',

  group: 'block',

  atom: true,

  selectable: true,

  addAttributes() {
    return {
      title: { default: '目录' },
      withPageNumbers: { default: true },
      entries: { default: [] as TocEntry[] },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toc-block"]' }];
  },

  renderHTML({ node }) {
    const title = String(node.attrs.title ?? '目录');
    const withPageNumbers = Boolean(node.attrs.withPageNumbers);
    const entries = Array.isArray(node.attrs.entries) ? (node.attrs.entries as TocEntry[]) : [];

    return [
      'div',
      {
        'data-type': 'toc-block',
        class: 'toc-block',
        contenteditable: 'false',
      },
      ['h1', { style: 'text-align:center' }, title],
      ['p', {}, '\u00a0'],
      ...entries.map((entry) => [
        'p',
        {
          class: 'toc-entry',
          'data-toc-level': String(entry.level),
          'data-toc-target': entry.anchorId,
          style: `font-size:${entry.level === 1 ? '16pt' : entry.level === 2 ? '14pt' : '12pt'};margin:4px 0;text-indent:0`,
        },
        ['span', {}, `${'\u2003'.repeat(Math.max(entry.level - 1, 0))}${entry.label}`],
        ...(withPageNumbers ? [['span', { style: 'float:right;color:#999' }, String(entry.page)]] : []),
      ]),
    ];
  },
});

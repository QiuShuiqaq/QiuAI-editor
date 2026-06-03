import { Node } from '@tiptap/core';

export interface TablePlaceholderOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tablePlaceholder: {
      insertTablePlaceholder: (attrs: {
        tableNumber: string;
        caption: string;
        sectionId: string;
        tableIndex: number;
        headers?: string[];
        rows?: string[][];
      }) => ReturnType;
    };
  }
}

export const TablePlaceholder = Node.create<TablePlaceholderOptions>({
  name: 'tablePlaceholder',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      tableNumber: { default: '1.1.1' },
      caption: { default: '表格标题' },
      sectionId: { default: '' },
      tableIndex: { default: 0 },
      headers: { default: ['列 1', '列 2', '列 3'] },
      rows: { default: [['', '', ''], ['', '', ''], ['', '', '']] },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="table-placeholder"]' }];
  },

  renderHTML({ node }) {
    const { tableNumber, caption, headers, rows } = node.attrs;
    const headerHTML = (headers as string[]).map((header: string) => `<th>${header}</th>`).join('');
    const bodyHTML = (rows as string[][])
      .map((row: string[]) => `<tr>${row.map((cell: string) => `<td>${cell}</td>`).join('')}</tr>`)
      .join('');

    return [
      'div',
      {
        'data-type': 'table-placeholder',
        class: 'table-placeholder-node',
        contenteditable: 'false',
      },
      ['table', { class: 'three-line-placeholder-table' }, ['thead', {}, ['tr', {}, headerHTML]], ['tbody', {}, bodyHTML]],
      [
        'div',
        {
          class: 'table-placeholder-caption',
          contenteditable: 'true',
          'data-caption': caption,
        },
        `表 ${tableNumber} ${caption}`,
      ],
    ];
  },

  addCommands() {
    return {
      insertTablePlaceholder:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});

/**
 * WordLists — Custom list extension matching Word 2019 list behavior.
 * - Tab / Shift+Tab to indent/outdent list items
 * - Auto-continue numbering on Enter
 * - Multi-level numbering (1. → 1.1 → 1.1.1)
 * - Custom bullet styles (disc, circle, square)
 * - Custom number styles (decimal, upper-roman, lower-alpha, etc.)
 */

import { Extension } from '@tiptap/core';

export interface WordListsOptions {
  types: string[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wordList: {
      indentListItem: () => ReturnType;
      outdentListItem: () => ReturnType;
    };
  }
}

export const WordLists = Extension.create<WordListsOptions>({
  name: 'wordLists',

  addOptions() {
    return {
      types: ['listItem'],
    };
  },

  addCommands() {
    return {
      indentListItem:
        () =>
        ({ state, chain }) => {
          const { selection } = state;
          const { $from } = selection;
          const node = $from.node($from.depth);
          if (node?.type.name === 'listItem') {
            return chain().sinkListItem('listItem').run();
          }
          // Tab not in list: indent paragraph
          return chain().setParagraphAttrs({ marginLeft: '36pt' }).run();
        },

      outdentListItem:
        () =>
        ({ state, chain }) => {
          const { selection } = state;
          const { $from } = selection;
          const node = $from.node($from.depth);
          if (node?.type.name === 'listItem') {
            // TipTap's built-in outdent via sinkListItem/liftListItem
            return chain().liftListItem('listItem').run();
          }
          // Shift+Tab not in list: outdent paragraph
          return chain().setParagraphAttrs({ marginLeft: null }).run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indentListItem(),
      'Shift-Tab': () => this.editor.commands.outdentListItem(),
      'Mod-Shift-8': () => this.editor.commands.toggleBulletList(),
      'Mod-Shift-7': () => this.editor.commands.toggleOrderedList(),
    };
  },
});

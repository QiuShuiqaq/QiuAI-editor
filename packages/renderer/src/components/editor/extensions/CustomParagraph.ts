import { Node, mergeAttributes } from '@tiptap/core';

export interface CustomParagraphOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customParagraph: {
      setParagraphAttrs: (attrs: ParagraphAttrs) => ReturnType;
    };
  }
}

export interface ParagraphAttrs {
  lineHeight?: string | null;
  textIndent?: string | null;
  marginLeft?: string | null;
  marginRight?: string | null;
  spaceBefore?: string | null;
  spaceAfter?: string | null;
  textAlign?: string | null;
}

function buildStyle(attrs: ParagraphAttrs): string {
  const parts: string[] = [];
  if (attrs.lineHeight) parts.push(`line-height:${attrs.lineHeight}`);
  if (attrs.textIndent) parts.push(`text-indent:${attrs.textIndent}`);
  if (attrs.marginLeft) parts.push(`margin-left:${attrs.marginLeft}`);
  if (attrs.marginRight) parts.push(`margin-right:${attrs.marginRight}`);
  if (attrs.spaceBefore) parts.push(`margin-top:${attrs.spaceBefore}`);
  if (attrs.spaceAfter) parts.push(`margin-bottom:${attrs.spaceAfter}`);
  if (attrs.textAlign) parts.push(`text-align:${attrs.textAlign}`);
  return parts.join(';');
}

export const CustomParagraph = Node.create<CustomParagraphOptions>({
  name: 'paragraph',

  group: 'block',

  content: 'inline*',

  // Override StarterKit's default paragraph
  priority: 1000,

  addAttributes() {
    return {
      lineHeight: { default: null },
      textIndent: { default: '2em' },
      marginLeft: { default: null },
      marginRight: { default: null },
      spaceBefore: { default: null },
      spaceAfter: { default: '8px' },
      textAlign: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'p' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as ParagraphAttrs;
    const style = buildStyle(attrs);

    return [
      'p',
      mergeAttributes(HTMLAttributes, { style: style || undefined }),
      0,
    ];
  },

  addCommands() {
    return {
      setParagraphAttrs:
        (attrs: ParagraphAttrs) =>
        ({ commands, state }) => {
          const { from, to } = state.selection;
          if (from === to) {
            // No selection, apply to current paragraph
            const $pos = state.selection.$from;
            const node = $pos.node($pos.depth);
            if (node.type.name === 'paragraph') {
              const pos = $pos.before($pos.depth);
              const existing = { ...node.attrs } as ParagraphAttrs;
              const merged = { ...existing, ...attrs };
              return commands.updateAttributes('paragraph', merged);
            }
          }
          // Apply to all paragraphs in selection
          return commands.updateAttributes('paragraph', attrs);
        },
    };
  },
});

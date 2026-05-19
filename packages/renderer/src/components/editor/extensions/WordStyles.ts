/**
 * WordStyles — Apply named styles to paragraphs, matching Word 2019 behavior.
 * - Applying a style sets ALL paragraph+text attributes at once
 * - Heading styles convert paragraphs to heading nodes
 * - Paragraph tracks its applied styleName for later updating
 */

import { Extension } from '@tiptap/core';
import type { NamedStyle } from '../../../stores/useStyleStore';
import { useStyleStore } from '../../../stores/useStyleStore';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wordStyles: {
      applyStyle: (styleName: string) => ReturnType;
      updateAllParagraphsWithStyle: (styleName: string) => ReturnType;
    };
  }
}

export const WordStyles = Extension.create({
  name: 'wordStyles',

  addCommands() {
    return {
      applyStyle:
        (styleName: string) =>
        ({ chain, state, editor }) => {
          const store = useStyleStore.getState();
          const style = store.getStyle(styleName);
          if (!style) return false;

          // If this is a heading style, convert paragraph to heading
          if (style.headingLevel) {
            return chain()
              .focus()
              .setNode('heading', { level: style.headingLevel })
              .run();
          }

          // Build all text/paragraph attributes from style definition
          const result = chain().focus();

          // Apply text formatting via TextStyle mark
          const textStyleAttrs: Record<string, string> = {};
          if (style.text.fontFamily) textStyleAttrs.fontFamily = style.text.fontFamily;
          if (style.text.fontSize) textStyleAttrs.fontSize = style.text.fontSize;
          if (style.text.color && style.text.color !== '#000000') textStyleAttrs.color = style.text.color;

          if (Object.keys(textStyleAttrs).length > 0) {
            result.setMark('textStyle', textStyleAttrs);
          }

          // Toggle text marks
          if (style.text.bold) result.setBold();
          else result.unsetBold();

          if (style.text.italic) result.setItalic();
          else result.unsetItalic();

          if (style.text.underline) result.setUnderline();

          // Apply paragraph attributes
          const paraAttrs: Record<string, string | null> = {};
          if (style.paragraph.textAlign !== undefined) paraAttrs.textAlign = style.paragraph.textAlign;
          if (style.paragraph.lineHeight !== undefined) paraAttrs.lineHeight = style.paragraph.lineHeight;
          if (style.paragraph.textIndent !== undefined) paraAttrs.textIndent = style.paragraph.textIndent;
          if (style.paragraph.spaceBefore !== undefined) paraAttrs.spaceBefore = style.paragraph.spaceBefore;
          if (style.paragraph.spaceAfter !== undefined) paraAttrs.spaceAfter = style.paragraph.spaceAfter;

          // Store style name on paragraph for future updates
          (paraAttrs as Record<string, unknown>).styleName = styleName;

          result.setParagraphAttrs(paraAttrs);
          return result.run();
        },

      updateAllParagraphsWithStyle:
        (styleName: string) =>
        ({ state, commands }) => {
          const store = useStyleStore.getState();
          const style = store.getStyle(styleName);
          if (!style) return false;

          let changed = false;
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'paragraph' && node.attrs.styleName === styleName) {
              // Re-apply style attributes to this paragraph
              // (We'd need to use commands at this position, but that's complex
              //  from a read-only traversal. For now, flag that changes are needed.)
              changed = true;
            }
          });

          if (changed) {
            // Trigger re-application loop — apply style at current cursor
            // Full document scan would need tr.setNodeMarkup for each match
            const tr = state.tr;
            state.doc.descendants((node, pos) => {
              if (node.type.name === 'paragraph' && node.attrs.styleName === styleName) {
                const newAttrs = { ...node.attrs };
                if (style.paragraph.lineHeight) newAttrs.lineHeight = style.paragraph.lineHeight;
                if (style.paragraph.textIndent !== undefined) newAttrs.textIndent = style.paragraph.textIndent;
                if (style.paragraph.spaceAfter !== undefined) newAttrs.spaceAfter = style.paragraph.spaceAfter;
                tr.setNodeMarkup(pos, undefined, newAttrs);
              }
            });
            commands.command(({ tr: _tr }) => true); // dummy to trigger update
            // Actually apply via dispatch
            const { view } = this.editor;
            view.dispatch(tr);
          }

          return true;
        },
    };
  },
});

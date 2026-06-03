import { Extension } from '@tiptap/core';
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
        ({ chain }) => {
          const style = useStyleStore.getState().getStyle(styleName);
          if (!style) return false;

          if (style.headingLevel) {
            return chain()
              .focus()
              .setNode('heading', { level: style.headingLevel, styleName })
              .run();
          }

          const result = chain().focus().setNode('paragraph');

          const textStyleAttrs: Record<string, string> = {};
          if (style.text.fontFamily) textStyleAttrs.fontFamily = style.text.fontFamily;
          if (style.text.fontSize) textStyleAttrs.fontSize = style.text.fontSize;
          if (style.text.color) textStyleAttrs.color = style.text.color;

          if (Object.keys(textStyleAttrs).length > 0) {
            result.setMark('textStyle', textStyleAttrs);
          }

          if (style.text.bold) result.setBold();
          else result.unsetBold();

          if (style.text.italic) result.setItalic();
          else result.unsetItalic();

          if (style.text.underline) result.setUnderline();
          else result.unsetUnderline();

          result.setParagraphAttrs({
            textAlign: style.paragraph.textAlign ?? null,
            lineHeight: style.paragraph.lineHeight ?? null,
            textIndent: style.paragraph.textIndent ?? null,
            spaceBefore: style.paragraph.spaceBefore ?? null,
            spaceAfter: style.paragraph.spaceAfter ?? null,
            class: style.paragraph.className ?? null,
            styleName,
          });

          return result.run();
        },

      updateAllParagraphsWithStyle:
        (styleName: string) =>
        ({ state, commands }) => {
          const style = useStyleStore.getState().getStyle(styleName);
          if (!style) return false;

          const tr = state.tr;
          let changed = false;

          state.doc.descendants((node, pos) => {
            if (node.type.name !== 'paragraph' || node.attrs.styleName !== styleName) {
              return;
            }

            const nextAttrs = {
              ...node.attrs,
              textAlign: style.paragraph.textAlign ?? null,
              lineHeight: style.paragraph.lineHeight ?? null,
              textIndent: style.paragraph.textIndent ?? null,
              spaceBefore: style.paragraph.spaceBefore ?? null,
              spaceAfter: style.paragraph.spaceAfter ?? null,
              class: style.paragraph.className ?? null,
              styleName,
            };

            tr.setNodeMarkup(pos, undefined, nextAttrs);
            changed = true;
          });

          if (changed) {
            commands.command(() => true);
            this.editor.view.dispatch(tr);
          }

          return true;
        },
    };
  },
});

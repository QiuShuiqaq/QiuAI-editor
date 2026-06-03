import { Extension } from '@tiptap/core';

function buildInlineStyle(property: string, value: string | null | undefined): string | undefined {
  if (!value || !value.trim()) {
    return undefined;
  }

  return `${property}: ${value}`;
}

export const TextStyleFormatting = Extension.create({
  name: 'textStyleFormatting',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element) => element.style.fontFamily || null,
            renderHTML: (attributes) => {
              const style = buildInlineStyle('font-family', attributes.fontFamily);
              return style ? { style } : {};
            },
          },
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              const style = buildInlineStyle('font-size', attributes.fontSize);
              return style ? { style } : {};
            },
          },
          color: {
            default: null,
            parseHTML: (element) => element.style.color || null,
            renderHTML: (attributes) => {
              const style = buildInlineStyle('color', attributes.color);
              return style ? { style } : {};
            },
          },
        },
      },
    ];
  },
});

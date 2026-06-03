/**
 * ParagraphBorders — Extends CustomParagraph with border & shading support.
 * Adds paragraph-level attributes: borderStyle, borderColor, borderWidth,
 * borderSide, bgColor (shading).
 *
 * Usage in renderHTML: converts attrs to CSS border/background on <p>.
 */

import { Extension } from '@tiptap/core';

export interface BorderShadingAttrs {
  borderSide: 'all' | 'top' | 'bottom' | 'left' | 'right' | 'none';
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
  borderColor: string;
  borderWidth: string;  // e.g. "1pt", "0.5pt", "1.5pt"
  bgColor: string;      // e.g. "#ffff00" or "transparent"
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphBorders: {
      setParagraphBorder: (attrs: Partial<BorderShadingAttrs>) => ReturnType;
      setParagraphShading: (color: string) => ReturnType;
      clearParagraphBorder: () => ReturnType;
    };
  }
}

export const ParagraphBorders = Extension.create({
  name: 'paragraphBorders',

  addCommands() {
    return {
      setParagraphBorder:
        (attrs) =>
        ({ chain }) => {
          const style: Record<string, string | null> = {};

          const side = attrs.borderSide || 'all';
          const borderStyle = attrs.borderStyle || 'solid';
          const borderColor = attrs.borderColor || '#000000';
          const borderWidth = attrs.borderWidth || '0.5pt';

          const borderValue = `${borderWidth} ${borderStyle} ${borderColor}`;

          if (side === 'all') {
            style.borderTop = borderValue;
            style.borderBottom = borderValue;
            style.borderLeft = borderValue;
            style.borderRight = borderValue;
          } else if (side === 'top') {
            style.borderTop = borderValue;
          } else if (side === 'bottom') {
            style.borderBottom = borderValue;
          } else if (side === 'left') {
            style.borderLeft = borderValue;
          } else if (side === 'right') {
            style.borderRight = borderValue;
          }

          // We need to store border info on the paragraph node
          // Since CustomParagraph doesn't have border attrs, use a dedicated approach:
          // Convert to CSS via updateAttributes or inject into the node
          const chainResult = chain();
          for (const [key, value] of Object.entries(style)) {
            if (value) {
              chainResult.updateAttributes('paragraph', {
                [key]: value,
              } as Record<string, unknown>);
            }
          }
          return chainResult.run();
        },

      setParagraphShading:
        (color) =>
        ({ chain }) => {
          return chain()
            .updateAttributes('paragraph', {
              bgColor: color || 'transparent',
            } as Record<string, unknown>)
            .run();
        },

      clearParagraphBorder:
        () =>
        ({ chain }) => {
          return chain()
            .updateAttributes('paragraph', {
              borderTop: null,
              borderBottom: null,
              borderLeft: null,
              borderRight: null,
              bgColor: null,
            } as Record<string, unknown>)
            .run();
        },
    };
  },
});

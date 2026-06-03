import { Node } from '@tiptap/core';

export interface ImagePlaceholderOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imagePlaceholder: {
      insertImagePlaceholder: (attrs: {
        figureNumber: string;
        caption: string;
        sectionId: string;
        imageIndex: number;
        imageData?: string | null;
      }) => ReturnType;
    };
  }
}

export const ImagePlaceholder = Node.create<ImagePlaceholderOptions>({
  name: 'imagePlaceholder',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      figureNumber: { default: '1.1.1' },
      caption: { default: '图片标题' },
      sectionId: { default: '' },
      imageIndex: { default: 0 },
      imageData: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-placeholder"]' }];
  },

  renderHTML({ node }) {
    const { figureNumber, caption, imageData } = node.attrs as {
      figureNumber: string;
      caption: string;
      imageData?: string | null;
    };

    return [
      'div',
      {
        'data-type': 'image-placeholder',
        class: 'image-placeholder-node',
        contenteditable: 'false',
      },
      imageData
        ? [
            'div',
            { class: 'image-placeholder-box image-placeholder-filled' },
            ['img', { src: imageData, alt: caption, class: 'image-placeholder-preview' }],
          ]
        : [
            'div',
            { class: 'image-placeholder-box' },
            ['div', { class: 'image-placeholder-icon' }, '🖼'],
            ['div', { class: 'image-placeholder-hint' }, '双击或拖放图片到此处'],
          ],
      [
        'div',
        {
          class: 'image-placeholder-caption',
          contenteditable: 'true',
          'data-caption': caption,
        },
        `图 ${figureNumber} ${caption}`,
      ],
    ];
  },

  addCommands() {
    return {
      insertImagePlaceholder:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});

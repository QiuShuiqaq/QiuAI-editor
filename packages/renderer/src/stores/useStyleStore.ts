import { create } from 'zustand';

export interface TextStyle {
  fontFamily: string;
  fontSize: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
}

export interface ParagraphStyle {
  textAlign: string | null;
  lineHeight: string | null;
  textIndent: string | null;
  spaceBefore: string | null;
  spaceAfter: string | null;
  className: string | null;
}

export interface NamedStyle {
  name: string;
  displayName: string;
  text: Partial<TextStyle>;
  paragraph: Partial<ParagraphStyle>;
  headingLevel?: number;
  nextStyle?: string;
}

const DEFAULT_STYLES: NamedStyle[] = [
  {
    name: 'Normal',
    displayName: '正文',
    text: {
      fontFamily: 'FangSong',
      fontSize: '16pt',
      bold: false,
      italic: false,
      underline: false,
      color: '#000000',
    },
    paragraph: {
      textAlign: null,
      lineHeight: '1.5',
      textIndent: '2em',
      spaceBefore: null,
      spaceAfter: '8px',
      className: 'body-text',
    },
    nextStyle: 'Normal',
  },
  {
    name: 'Heading1',
    displayName: '标题 1',
    text: {
      fontFamily: 'SimHei',
      fontSize: '22pt',
      bold: true,
      italic: false,
      underline: false,
      color: '#000000',
    },
    paragraph: {
      textAlign: 'center',
      lineHeight: '1.4',
      textIndent: null,
      spaceBefore: '24px',
      spaceAfter: '16px',
      className: null,
    },
    headingLevel: 1,
    nextStyle: 'Normal',
  },
  {
    name: 'Heading2',
    displayName: '标题 2',
    text: {
      fontFamily: 'SimHei',
      fontSize: '16pt',
      bold: true,
      italic: false,
      underline: false,
      color: '#000000',
    },
    paragraph: {
      textAlign: null,
      lineHeight: '1.4',
      textIndent: null,
      spaceBefore: '20px',
      spaceAfter: '12px',
      className: null,
    },
    headingLevel: 2,
    nextStyle: 'Normal',
  },
  {
    name: 'Heading3',
    displayName: '标题 3',
    text: {
      fontFamily: 'SimHei',
      fontSize: '14pt',
      bold: true,
      italic: false,
      underline: false,
      color: '#000000',
    },
    paragraph: {
      textAlign: null,
      lineHeight: '1.4',
      textIndent: null,
      spaceBefore: '16px',
      spaceAfter: '10px',
      className: null,
    },
    headingLevel: 3,
    nextStyle: 'Normal',
  },
  {
    name: 'Caption',
    displayName: '图注',
    text: {
      fontFamily: 'SimSun',
      fontSize: '10.5pt',
      bold: false,
      italic: false,
      underline: false,
      color: '#666666',
    },
    paragraph: {
      textAlign: 'center',
      lineHeight: '1.4',
      textIndent: null,
      spaceBefore: '4px',
      spaceAfter: '16px',
      className: 'image-text',
    },
    nextStyle: 'Normal',
  },
  {
    name: 'TableCaption',
    displayName: '表注',
    text: {
      fontFamily: 'SimSun',
      fontSize: '10.5pt',
      bold: false,
      italic: false,
      underline: false,
      color: '#666666',
    },
    paragraph: {
      textAlign: 'center',
      lineHeight: '1.4',
      textIndent: null,
      spaceBefore: '4px',
      spaceAfter: '16px',
      className: 'table-text',
    },
    nextStyle: 'Normal',
  },
  {
    name: 'Quote',
    displayName: '引用',
    text: {
      fontFamily: 'FangSong',
      fontSize: '14pt',
      bold: false,
      italic: true,
      underline: false,
      color: '#444444',
    },
    paragraph: {
      textAlign: null,
      lineHeight: '1.6',
      textIndent: '2em',
      spaceBefore: '8px',
      spaceAfter: '12px',
      className: 'quote-text',
    },
    nextStyle: 'Normal',
  },
];

interface StyleState {
  styles: NamedStyle[];
  updateStyle: (name: string, updates: Partial<NamedStyle>) => void;
  getStyle: (name: string) => NamedStyle | undefined;
  resetStyles: () => void;
}

export const useStyleStore = create<StyleState>((set, get) => ({
  styles: [...DEFAULT_STYLES],

  updateStyle: (name, updates) => {
    set((state) => ({
      styles: state.styles.map((style) => (style.name === name ? { ...style, ...updates } : style)),
    }));
  },

  getStyle: (name) => get().styles.find((style) => style.name === name),

  resetStyles: () => set({ styles: [...DEFAULT_STYLES] }),
}));

export { DEFAULT_STYLES };

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
}

export interface NamedStyle {
  name: string;
  displayName: string;
  text: Partial<TextStyle>;
  paragraph: Partial<ParagraphStyle>;
  headingLevel?: number;
  nextStyle?: string;  // Style for next paragraph after Enter
}

// Default Word-like styles
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
    },
    headingLevel: 3,
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
      styles: state.styles.map((s) =>
        s.name === name ? { ...s, ...updates } : s
      ),
    }));
  },

  getStyle: (name) => get().styles.find((s) => s.name === name),

  resetStyles: () => set({ styles: [...DEFAULT_STYLES] }),
}));

export { DEFAULT_STYLES };

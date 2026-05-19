/**
 * Format Painter service — replicates Word's format painter behavior.
 *
 * - Single click: copy format once, paste once, then deactivate
 * - Double click: copy format, enter continuous mode (paste multiple times)
 * - ESC: exit format painter
 * - Copies BOTH text marks (bold/italic/font/etc.) AND paragraph attributes (lineHeight/indent/align)
 */

import type { Editor } from '@tiptap/react';

export interface CopiedFormat {
  textMarks: Array<{ type: string; attrs: Record<string, unknown> }>;
  paragraphAttrs: Record<string, unknown>;
  fontFamily: string | null;
  fontSize: string | null;
  color: string | null;
}

class FormatPainterService {
  private copied: CopiedFormat | null = null;
  private continuous = false;
  private editor: Editor | null = null;
  private onChange: (() => void) | null = null;

  setEditor(editor: Editor | null) {
    this.editor = editor;
  }

  onChangeCallback(cb: () => void) {
    this.onChange = cb;
  }

  get isActive(): boolean {
    return this.copied !== null;
  }

  get isContinuous(): boolean {
    return this.continuous;
  }

  /** Copy format from current selection or cursor position */
  copyFormat(): void {
    if (!this.editor) return;
    const { state } = this.editor;
    const { from, to } = state.selection;

    // Collect text marks at the start of selection (or cursor)
    const $pos = state.doc.resolve(from);
    const marks = $pos.marks();
    const textMarks = marks.map((m) => ({
      type: m.type.name,
      attrs: { ...m.attrs },
    }));

    // Collect TextStyle attributes
    const textStyleAttrs = this.editor.getAttributes('textStyle');
    const fontFamily = textStyleAttrs.fontFamily || null;
    const fontSize = textStyleAttrs.fontSize || null;
    const color = textStyleAttrs.color || null;

    // Collect paragraph attributes from the paragraph at cursor
    const paragraphAttrs: Record<string, unknown> = {};
    const node = $pos.node($pos.depth);
    if (node?.type.name === 'paragraph') {
      for (const [key, value] of Object.entries(node.attrs)) {
        if (value !== null && value !== undefined) {
          paragraphAttrs[key] = value;
        }
      }
    }

    this.copied = { textMarks, paragraphAttrs, fontFamily, fontSize, color };
    this.onChange?.();
  }

  /** Paste copied format onto current selection */
  pasteFormat(): void {
    if (!this.editor || !this.copied) return;
    const chain = this.editor.chain().focus();

    // Apply text marks
    const { textMarks, fontFamily, fontSize, color } = this.copied;

    // Clear existing marks first, then apply copied ones
    chain.unsetAllMarks();

    // Re-apply text style
    const styleAttrs: Record<string, string> = {};
    if (fontFamily) styleAttrs.fontFamily = fontFamily;
    if (fontSize) styleAttrs.fontSize = fontSize;
    if (color) styleAttrs.color = color;
    if (Object.keys(styleAttrs).length > 0) {
      chain.setMark('textStyle', styleAttrs);
    }

    // Apply text marks (bold, italic, etc.)
    for (const mark of textMarks) {
      if (mark.type === 'bold') chain.setBold();
      else if (mark.type === 'italic') chain.setItalic();
      else if (mark.type === 'underline') chain.setUnderline();
      else if (mark.type === 'strike') chain.setStrike();
      else chain.setMark(mark.type, mark.attrs);
    }

    chain.run();

    // Apply paragraph attributes
    if (Object.keys(this.copied.paragraphAttrs).length > 0) {
      this.editor.chain().focus().setParagraphAttrs(
        this.copied.paragraphAttrs as Record<string, string | null>
      ).run();
    }

    // If not in continuous mode, clear after one paste
    if (!this.continuous) {
      this.clear();
    }
    this.onChange?.();
  }

  /** Enter format painter mode */
  activate(continuous = false): void {
    this.continuous = continuous;
    if (!this.copied) {
      this.copyFormat();
    }
    this.onChange?.();
  }

  /** Exit format painter */
  clear(): void {
    this.copied = null;
    this.continuous = false;
    this.onChange?.();
  }
}

export const formatPainter = new FormatPainterService();

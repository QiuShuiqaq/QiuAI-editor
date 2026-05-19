/**
 * AutoCorrect — Common text replacements and typo fixes.
 * Rules: (c)→©, (r)→®, --> → →, << → «, etc.
 * Tracks last typed word for correction.
 */
import { useEffect } from 'react';
import { useEditorStore } from '../stores/useEditorStore';

const CORRECTIONS: Record<string, string> = {
  '(c)': '©',
  '(r)': '®',
  '(tm)': '™',
  '-->': '→',
  '<--': '←',
  '==>': '⇒',
  '<==': '⇐',
  '<<': '«',
  '>>': '»',
  '...': '…',
  '---': '—',
  '--': '–',
};

export function useAutoCorrect() {
  const editor = useEditorStore((s) => s.editor);

  useEffect(() => {
    if (!editor) return;

    const handleInput = () => {
      const { state } = editor;
      const { from } = state.selection;
      const $pos = state.doc.resolve(from);
      const textBefore = $pos.nodeBefore?.text || '';

      // Check last 5 chars for trigger
      for (const [trigger, replacement] of Object.entries(CORRECTIONS)) {
        if (textBefore.endsWith(trigger)) {
          const start = from - trigger.length;
          editor
            .chain()
            .focus()
            .deleteRange({ from: start, to: from })
            .insertContent(replacement)
            .run();
          break;
        }
      }
    };

    editor.on('update', handleInput);
    return () => { editor.off('update', handleInput); };
  }, [editor]);
}

import { useEffect } from 'react';
import { useEditorStore } from '../stores/useEditorStore';
import { useProjectStore } from '../stores/useProjectStore';
import { IPC_CHANNELS, type IPCResponse } from '@qiuai/shared';
import { ipcClient } from '../services/ipcClient';
import { formatPainter } from '../services/formatPainter';
import { message } from 'antd';

export function useKeyboardShortcuts() {
  const editor = useEditorStore((s) => s.editor);
  const doc = useProjectStore((s) => s.doc);
  const setDirty = useEditorStore((s) => s.setDirty);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // ESC: Exit format painter
      if (e.key === 'Escape') {
        if (formatPainter.isActive) {
          e.preventDefault();
          formatPainter.clear();
          return;
        }
        return;
      }

      // Ctrl+S: Save
      if (mod && e.key === 's') {
        e.preventDefault();
        try {
          const currentDoc = useProjectStore.getState().doc;
          const currentEditor = useEditorStore.getState().editor;
          const docToSave = {
            ...currentDoc,
            editorContent: currentEditor?.getJSON() || currentDoc.editorContent,
            updatedAt: new Date().toISOString(),
          };

          const result = await ipcClient.invoke<IPCResponse>(
            IPC_CHANNELS.FILE_SAVE_DRAFT,
            docToSave
          );

          if (result.success) {
            setDirty(false);
            message.success('已保存');
          } else {
            message.error('保存失败');
          }
        } catch {
          message.error('保存失败');
        }
        return;
      }

      // Ctrl+F: Find
      if (mod && !e.shiftKey && e.key === 'f') {
        e.preventDefault();
        (window as any).__editorShowFind?.();
        return;
      }

      // Ctrl+H: Replace
      if (mod && !e.shiftKey && e.key === 'h') {
        e.preventDefault();
        (window as any).__editorShowReplace?.();
        return;
      }

      // Ctrl+Shift+C: Copy format (format painter)
      if (mod && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        formatPainter.copyFormat();
        formatPainter.activate(false);
        message.success('格式已复制 — 点击目标文本粘贴格式');
        return;
      }

      // Ctrl+Shift+V: Paste format
      if (mod && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        if (formatPainter.isActive) {
          formatPainter.pasteFormat();
        } else {
          message.warning('请先使用 Ctrl+Shift+C 复制格式');
        }
        return;
      }

      // Ctrl+Space or Ctrl+Shift+N: Clear formatting
      if ((mod && !e.shiftKey && e.key === ' ') || (mod && e.shiftKey && e.key === 'N')) {
        e.preventDefault();
        editor?.chain().focus().unsetAllMarks().run();
        editor?.chain().focus().setParagraphAttrs({
          lineHeight: null, textIndent: '2em', marginLeft: null,
          marginRight: null, spaceBefore: null, spaceAfter: '8px', textAlign: null,
        }).run();
        message.success('已清除格式');
        return;
      }

      // Ctrl+B: Bold
      if (mod && e.key === 'b') {
        e.preventDefault();
        editor?.chain().focus().toggleBold().run();
        return;
      }

      // Ctrl+I: Italic
      if (mod && e.key === 'i') {
        e.preventDefault();
        editor?.chain().focus().toggleItalic().run();
        return;
      }

      // Ctrl+U: Underline
      if (mod && e.key === 'u') {
        e.preventDefault();
        editor?.chain().focus().toggleUnderline().run();
        return;
      }

      // Ctrl+Z: Undo
      if (mod && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        editor?.chain().focus().undo().run();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z: Redo
      if ((mod && e.key === 'y') || (mod && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        editor?.chain().focus().redo().run();
        return;
      }
    };

    // Also handle click on editor to paste format if painter is active
    const handleEditorClick = () => {
      if (formatPainter.isActive) {
        // Paste format on click target
        formatPainter.pasteFormat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleEditorClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleEditorClick);
    };
  }, [editor, doc, setDirty]);
}

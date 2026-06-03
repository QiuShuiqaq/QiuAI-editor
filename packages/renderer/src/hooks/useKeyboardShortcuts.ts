import { useEffect } from 'react';
import { message } from 'antd';
import { formatPainter } from '../services/formatPainter';
import { saveCurrentDocument } from '../services/documentEngineCommands';
import { useDocumentEngineStore } from '../stores/useDocumentEngineStore';
import { useEditorStore } from '../stores/useEditorStore';
import { supportsDocumentCommands } from '../utils/documentEngineCapabilities';

export function useKeyboardShortcuts() {
  const editor = useEditorStore((state) => state.editor);
  const setDirty = useEditorStore((state) => state.setDirty);

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const documentEngineAdapter = useDocumentEngineStore.getState().adapter;
      const runPreviewCommand = async (command: string, payload: Record<string, unknown> = {}) => {
        if (!supportsDocumentCommands(documentEngineAdapter) || !documentEngineAdapter?.executeCommand) {
          return false;
        }
        return documentEngineAdapter.executeCommand(command, payload);
      };

      if (event.key === 'Escape') {
        if (formatPainter.isActive) {
          event.preventDefault();
          formatPainter.clear();
        }
        return;
      }

      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        try {
          await saveCurrentDocument();
          setDirty(false);
          message.success('文档已保存');
        } catch {
          message.error('保存失败');
        }
        return;
      }

      if (mod && !event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        (window as { __editorShowFind?: () => void }).__editorShowFind?.();
        return;
      }

      if (mod && !event.shiftKey && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        (window as { __editorShowReplace?: () => void }).__editorShowReplace?.();
        return;
      }

      if (mod && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        formatPainter.copyFormat();
        formatPainter.activate(false);
        message.success('格式已复制，点击目标文本即可套用格式');
        return;
      }

      if (mod && event.shiftKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        if (formatPainter.isActive) {
          formatPainter.pasteFormat();
        } else {
          message.warning('请先使用 Ctrl+Shift+C 复制格式');
        }
        return;
      }

      if ((mod && !event.shiftKey && event.key === ' ') || (mod && event.shiftKey && event.key.toLowerCase() === 'n')) {
        event.preventDefault();
        if (!(await runPreviewCommand('clear-formatting'))) {
          editor?.chain().focus().unsetAllMarks().run();
          editor
            ?.chain()
            .focus()
            .setParagraphAttrs({
              lineHeight: null,
              textIndent: '2em',
              marginLeft: null,
              marginRight: null,
              spaceBefore: null,
              spaceAfter: '8px',
              textAlign: null,
            })
            .run();
        }
        message.success('已清除格式');
        return;
      }

      if (mod && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        if (!(await runPreviewCommand('toggle-bold'))) {
          editor?.chain().focus().toggleBold().run();
        }
        return;
      }

      if (mod && event.key.toLowerCase() === 'i') {
        event.preventDefault();
        if (!(await runPreviewCommand('toggle-italic'))) {
          editor?.chain().focus().toggleItalic().run();
        }
        return;
      }

      if (mod && event.key.toLowerCase() === 'u') {
        event.preventDefault();
        if (!(await runPreviewCommand('toggle-underline'))) {
          editor?.chain().focus().toggleUnderline().run();
        }
        return;
      }

      if (mod && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (!(await runPreviewCommand('undo'))) {
          editor?.chain().focus().undo().run();
        }
        return;
      }

      if ((mod && event.key.toLowerCase() === 'y') || (mod && event.shiftKey && event.key.toLowerCase() === 'z')) {
        event.preventDefault();
        if (!(await runPreviewCommand('redo'))) {
          editor?.chain().focus().redo().run();
        }
      }
    };

    const handleEditorClick = () => {
      if (formatPainter.isActive) {
        formatPainter.pasteFormat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleEditorClick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleEditorClick);
    };
  }, [editor, setDirty]);
}

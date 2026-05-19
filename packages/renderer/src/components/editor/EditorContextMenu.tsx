/**
 * EditorContextMenu — Word-like right-click context menu.
 * Shows different options based on: text selected, on image, on table, or no selection.
 */
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../../stores/useEditorStore';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action: () => void;
  divider?: boolean;
  disabled?: boolean;
}

export function EditorContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const editor = useEditorStore((s) => s.editor);
  const selectedText = useEditorStore((s) => s.selectedText);
  const [hasSelection, setHasSelection] = useState(false);
  const [isImage, setIsImage] = useState(false);

  // Track selection state
  useEffect(() => {
    setHasSelection(!!selectedText);
  }, [selectedText]);

  // Handle right-click
  useEffect(() => {
    if (!editor) return;

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const editorDom = editor.view.dom;

      // Check if click is inside the editor
      if (!editorDom.contains(target)) {
        setMenu({ visible: false, x: 0, y: 0 });
        return;
      }

      e.preventDefault();

      // Check if on an image
      const onImage = target.tagName === 'IMG' || target.closest('img') !== null;
      setIsImage(onImage);

      setMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
      });
    };

    const handleClick = () => {
      setMenu({ visible: false, x: 0, y: 0 });
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
    };
  }, [editor]);

  const handleAction = useCallback((action: () => void) => {
    action();
    setMenu({ visible: false, x: 0, y: 0 });
  }, []);

  if (!menu.visible || !editor) return null;

  // Build menu items based on context
  const items: MenuItem[] = [];

  if (hasSelection) {
    items.push(
      { label: '剪切', shortcut: 'Ctrl+X', action: () => handleAction(() => document.execCommand('cut')) },
      { label: '复制', shortcut: 'Ctrl+C', action: () => handleAction(() => document.execCommand('copy')) },
      { label: '粘贴', shortcut: 'Ctrl+V', action: () => handleAction(() => navigator.clipboard.readText().then(t => editor.commands.insertContent(t))) },
    );
  } else {
    items.push(
      { label: '粘贴', shortcut: 'Ctrl+V', action: () => handleAction(() => navigator.clipboard.readText().then(t => editor.commands.insertContent(t))) },
    );
  }

  items.push({ label: '', action: () => {}, divider: true });

  if (hasSelection) {
    items.push(
      { label: '加粗', shortcut: 'Ctrl+B', action: () => handleAction(() => editor.chain().focus().toggleBold().run()) },
      { label: '斜体', shortcut: 'Ctrl+I', action: () => handleAction(() => editor.chain().focus().toggleItalic().run()) },
      { label: '下划线', shortcut: 'Ctrl+U', action: () => handleAction(() => editor.chain().focus().toggleUnderline().run()) },
      { label: '', action: () => {}, divider: true },
      { label: '清除格式', shortcut: 'Ctrl+Space', action: () => handleAction(() => {
        editor.chain().focus().unsetAllMarks().run();
        editor.chain().focus().setParagraphAttrs({
          lineHeight: null, textIndent: '2em', marginLeft: null, marginRight: null,
          spaceBefore: null, spaceAfter: '8px', textAlign: null,
        }).run();
      })},
    );
  }

  items.push(
    { label: '', action: () => {}, divider: true },
    { label: '撤销', shortcut: 'Ctrl+Z', action: () => handleAction(() => editor.chain().focus().undo().run()) },
    { label: '重做', shortcut: 'Ctrl+Y', action: () => handleAction(() => editor.chain().focus().redo().run()) },
    { label: '', action: () => {}, divider: true },
  );

  // Paragraph formatting (always available)
  items.push(
    { label: '段落...', action: () => handleAction(() => {
      // Focus paragraph formatting
      editor.chain().focus().setParagraphAttrs({ textIndent: '2em', lineHeight: '1.5' }).run();
    })},
    { label: '字体...', action: () => handleAction(() => {
      // Open font properties via right panel
      import('../../stores/useSidebarStore').then(m => m.useSidebarStore.getState().setActiveTab('text'));
    })},
  );

  if (isImage) {
    items.push(
      { label: '', action: () => {}, divider: true },
      { label: '替换图片', action: () => handleAction(() => { /* trigger image replace */ }) },
      { label: '删除图片', action: () => handleAction(() => {
        editor.chain().focus().deleteSelection().run();
      })},
    );
  }

  // Calculate position to keep menu within viewport
  const menuWidth = 200;
  const menuHeight = items.length * 32 + (items.filter(i => i.divider).length * 8);
  const x = Math.min(menu.x, window.innerWidth - menuWidth - 8);
  const y = Math.min(menu.y, window.innerHeight - menuHeight - 8);

  return createPortal(
    <div
      style={{
        position: 'fixed', left: x, top: y, zIndex: 10000,
        minWidth: 180, background: '#fff', borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)', border: '1px solid #e8e8e8',
        padding: '4px 0', fontSize: 13,
      }}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} style={{ height: 1, background: '#f0f0f0', margin: '4px 0' }} />
        ) : (
          <div
            key={i}
            onClick={item.disabled ? undefined : item.action}
            style={{
              padding: '6px 12px', cursor: item.disabled ? 'default' : 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: item.disabled ? 0.4 : 1,
              background: 'transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { if (!item.disabled) (e.target as HTMLElement).style.background = '#f5f5f5'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span style={{ color: '#999', fontSize: 11, marginLeft: 24 }}>{item.shortcut}</span>}
          </div>
        )
      )}
    </div>,
    document.body
  );
}

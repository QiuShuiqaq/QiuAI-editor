import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { message } from 'antd';
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BoldOutlined,
  CopyOutlined,
  DeleteOutlined,
  FontColorsOutlined,
  ItalicOutlined,
  ScissorOutlined,
  SearchOutlined,
  UndoOutlined,
  UnderlineOutlined,
} from '@ant-design/icons';
import { insertDocumentText, replaceCurrentSelection } from '../../services/documentEngineCommands';
import { useEditorStore } from '../../stores/useEditorStore';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

interface MenuItem {
  key: string;
  label?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action?: () => void | Promise<void>;
  divider?: boolean;
  disabled?: boolean;
  danger?: boolean;
}

export function EditorContextMenu() {
  const editor = useEditorStore((state) => state.editor);
  const formatting = useEditorStore((state) => state.formatting);
  const selectedText = useEditorStore((state) => state.selectedText);
  const [menu, setMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [isImage, setIsImage] = useState(false);

  const hasSelection = Boolean(selectedText.trim());

  useEffect(() => {
    if (!editor) return;

    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const editorDom = editor.view.dom;

      if (!editorDom.contains(target)) {
        setMenu({ visible: false, x: 0, y: 0 });
        return;
      }

      event.preventDefault();
      setIsImage(target.tagName === 'IMG' || target.closest('img') !== null);
      setMenu({ visible: true, x: event.clientX, y: event.clientY });
    };

    const handleClose = () => {
      setMenu({ visible: false, x: 0, y: 0 });
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClose);
    window.addEventListener('blur', handleClose);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClose);
      window.removeEventListener('blur', handleClose);
    };
  }, [editor]);

  const runAction = useCallback(async (action?: () => void | Promise<void>) => {
    if (!action) return;
    await action();
    setMenu({ visible: false, x: 0, y: 0 });
  }, []);

  const items = useMemo<MenuItem[]>(() => {
    if (!editor) return [];

    const baseItems: MenuItem[] = [
      {
        key: 'cut',
        label: '剪切',
        shortcut: 'Ctrl+X',
        icon: <ScissorOutlined />,
        disabled: !hasSelection,
        action: async () => {
          if (!selectedText.trim()) return;
          await navigator.clipboard.writeText(selectedText);
          await replaceCurrentSelection('');
          message.success('已剪切选中文本');
        },
      },
      {
        key: 'copy',
        label: '复制',
        shortcut: 'Ctrl+C',
        icon: <CopyOutlined />,
        disabled: !hasSelection,
        action: async () => {
          if (!selectedText.trim()) return;
          await navigator.clipboard.writeText(selectedText);
          message.success('已复制选中文本');
        },
      },
      {
        key: 'paste',
        label: '粘贴',
        shortcut: 'Ctrl+V',
        icon: <CopyOutlined />,
        action: async () => {
          try {
            const text = await navigator.clipboard.readText();
            if (!text) {
              message.info('剪贴板当前没有文本');
              return;
            }
            const applied = await insertDocumentText(text);
            if (!applied) {
              message.warning('当前插入位置无法粘贴文本，请调整光标位置后重试。');
            }
          } catch {
            message.warning('当前环境未授予剪贴板读取权限');
          }
        },
      },
      { key: 'divider-1', divider: true },
      {
        key: 'bold',
        label: formatting.isBold ? '取消加粗' : '加粗',
        shortcut: 'Ctrl+B',
        icon: <BoldOutlined />,
        disabled: !hasSelection,
        action: () => {
          editor.chain().focus().toggleBold().run();
        },
      },
      {
        key: 'italic',
        label: formatting.isItalic ? '取消斜体' : '斜体',
        shortcut: 'Ctrl+I',
        icon: <ItalicOutlined />,
        disabled: !hasSelection,
        action: () => {
          editor.chain().focus().toggleItalic().run();
        },
      },
      {
        key: 'underline',
        label: formatting.isUnderline ? '取消下划线' : '下划线',
        shortcut: 'Ctrl+U',
        icon: <UnderlineOutlined />,
        disabled: !hasSelection,
        action: () => {
          editor.chain().focus().toggleUnderline().run();
        },
      },
      {
        key: 'text-color',
        label: '字体颜色设为蓝色',
        icon: <FontColorsOutlined />,
        disabled: !hasSelection,
        action: () => {
          editor.chain().focus().setMark('textStyle', { color: '#1677ff' }).run();
        },
      },
      { key: 'divider-2', divider: true },
      {
        key: 'align-left',
        label: '左对齐',
        icon: <AlignLeftOutlined />,
        action: () => {
          editor.chain().focus().setTextAlign('left').run();
        },
      },
      {
        key: 'align-center',
        label: '居中',
        icon: <AlignCenterOutlined />,
        action: () => {
          editor.chain().focus().setTextAlign('center').run();
        },
      },
      {
        key: 'align-right',
        label: '右对齐',
        icon: <AlignRightOutlined />,
        action: () => {
          editor.chain().focus().setTextAlign('right').run();
        },
      },
      { key: 'divider-3', divider: true },
      {
        key: 'clear-format',
        label: '清除格式',
        shortcut: 'Ctrl+Space',
        action: () => {
          editor.chain().focus().unsetAllMarks().run();
          editor
            .chain()
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
          message.success('已清除格式');
        },
      },
      {
        key: 'paragraph',
        label: '恢复为标准正文段落',
        action: () => {
          editor.chain().focus().setParagraphAttrs({ textIndent: '2em', lineHeight: '1.5' }).run();
          message.success('已恢复正文段落样式');
        },
      },
      { key: 'divider-4', divider: true },
      {
        key: 'undo',
        label: '撤销',
        shortcut: 'Ctrl+Z',
        icon: <UndoOutlined />,
        action: () => {
          editor.chain().focus().undo().run();
        },
      },
      {
        key: 'find',
        label: '查找',
        shortcut: 'Ctrl+F',
        icon: <SearchOutlined />,
        action: () => (window as { __editorShowFind?: () => void }).__editorShowFind?.(),
      },
    ];

    if (isImage) {
      baseItems.push(
        { key: 'divider-image', divider: true },
        {
          key: 'delete-image',
          label: '删除图片',
          icon: <DeleteOutlined />,
          danger: true,
          action: () => {
            editor.chain().focus().deleteSelection().run();
          },
        }
      );
    }

    return baseItems;
  }, [editor, formatting.isBold, formatting.isItalic, formatting.isUnderline, hasSelection, isImage, selectedText]);

  if (!menu.visible || !editor) return null;

  const menuWidth = 240;
  const menuHeight = items.length * 34;
  const x = Math.min(menu.x, window.innerWidth - menuWidth - 8);
  const y = Math.min(menu.y, window.innerHeight - menuHeight - 8);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1400,
        minWidth: 220,
        background: '#fff',
        borderRadius: 10,
        boxShadow: '0 12px 28px rgba(0,0,0,0.16)',
        border: '1px solid #e8e8e8',
        padding: '6px 0',
        fontSize: 13,
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {items.map((item) =>
        item.divider ? (
          <div key={item.key} style={{ height: 1, background: '#f0f0f0', margin: '6px 0' }} />
        ) : (
          <button
            key={item.key}
            type="button"
            disabled={item.disabled}
            onClick={() => void runAction(item.action)}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              padding: '8px 12px',
              cursor: item.disabled ? 'default' : 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: item.disabled ? '#bfbfbf' : item.danger ? '#cf1322' : '#1f1f1f',
              textAlign: 'left',
            }}
            onMouseEnter={(event) => {
              if (!item.disabled) {
                event.currentTarget.style.background = '#f5f8ff';
              }
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, display: 'inline-flex', justifyContent: 'center' }}>{item.icon}</span>
              <span>{item.label}</span>
            </span>
            <span style={{ fontSize: 11, color: '#8c8c8c' }}>{item.shortcut}</span>
          </button>
        )
      )}
    </div>,
    document.body
  );
}

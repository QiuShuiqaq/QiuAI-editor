import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, ColorPicker, Divider, message } from 'antd';
import type { Color } from 'antd/es/color-picker';
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BgColorsOutlined,
  BoldOutlined,
  FontColorsOutlined,
  ItalicOutlined,
  RobotOutlined,
  UnderlineOutlined,
} from '@ant-design/icons';
import { polishText } from '../../services/aiClient';
import { useDocumentEngineStore } from '../../stores/useDocumentEngineStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { supportsVisualSelectionToolbar } from '../../utils/documentEngineCapabilities';

interface ToolbarPosition {
  left: number;
  top: number;
}

function ToolbarButton({
  active,
  title,
  icon,
  onClick,
}: {
  active?: boolean;
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type={active ? 'primary' : 'text'}
      size="small"
      title={title}
      icon={icon}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      style={{ width: 30, height: 30 }}
    />
  );
}

export function MiniToolbar() {
  const editor = useEditorStore((state) => state.editor);
  const documentEngineAdapter = useDocumentEngineStore((state) => state.adapter);
  const formatting = useEditorStore((state) => state.formatting);
  const selectedText = useEditorStore((state) => state.selectedText);
  const getWritingConfig = useSettingsStore((state) => state.getWritingConfig);
  const [position, setPosition] = useState<ToolbarPosition | null>(null);

  const visible = useMemo(() => {
    return Boolean(editor && supportsVisualSelectionToolbar(documentEngineAdapter) && selectedText.trim() && position);
  }, [documentEngineAdapter, editor, position, selectedText]);

  useEffect(() => {
    if (!editor || !supportsVisualSelectionToolbar(documentEngineAdapter)) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const { from, to } = editor.state.selection;
      if (from === to || !selectedText.trim()) {
        setPosition(null);
        return;
      }

      try {
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);
        const left = (start.left + end.right) / 2;
        const top = Math.min(start.top, end.top) - 52;
        setPosition({
          left: Math.max(16, Math.min(left, window.innerWidth - 220)),
          top: Math.max(72, top),
        });
      } catch {
        setPosition(null);
      }
    };

    updatePosition();
    editor.on('selectionUpdate', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      editor.off('selectionUpdate', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [documentEngineAdapter, editor, selectedText]);

  if (!visible || !position) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        transform: 'translateX(-50%)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 8px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid #d9d9d9',
        boxShadow: '0 10px 24px rgba(0,0,0,0.14)',
        backdropFilter: 'blur(10px)',
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <ToolbarButton
        active={formatting.isBold}
        title="加粗"
        icon={<BoldOutlined />}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        active={formatting.isItalic}
        title="斜体"
        icon={<ItalicOutlined />}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        active={formatting.isUnderline}
        title="下划线"
        icon={<UnderlineOutlined />}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      />
      <Divider type="vertical" style={{ height: 20, margin: '0 2px' }} />
      <ToolbarButton
        active={formatting.textAlign === 'left'}
        title="左对齐"
        icon={<AlignLeftOutlined />}
        onClick={() => editor?.chain().focus().setTextAlign('left').run()}
      />
      <ToolbarButton
        active={formatting.textAlign === 'center'}
        title="居中"
        icon={<AlignCenterOutlined />}
        onClick={() => editor?.chain().focus().setTextAlign('center').run()}
      />
      <ToolbarButton
        active={formatting.textAlign === 'right'}
        title="右对齐"
        icon={<AlignRightOutlined />}
        onClick={() => editor?.chain().focus().setTextAlign('right').run()}
      />
      <Divider type="vertical" style={{ height: 20, margin: '0 2px' }} />
      <ColorPicker
        value={formatting.color}
        onChange={(value: Color) =>
          editor?.chain().focus().setMark('textStyle', { color: value.toHexString() }).run()
        }
      >
        <div>
          <ToolbarButton title="字体颜色" icon={<FontColorsOutlined />} onClick={() => undefined} />
        </div>
      </ColorPicker>
      <ColorPicker
        value={formatting.highlightColor ?? '#fff59d'}
        onChange={(value: Color) =>
          editor?.chain().focus().toggleHighlight({ color: value.toHexString() }).run()
        }
      >
        <div>
          <ToolbarButton
            active={Boolean(formatting.highlightColor)}
            title="文本高亮"
            icon={<BgColorsOutlined />}
            onClick={() => undefined}
          />
        </div>
      </ColorPicker>
      <Divider type="vertical" style={{ height: 20, margin: '0 2px' }} />
      <ToolbarButton
        title="AI 润色"
        icon={<RobotOutlined />}
        onClick={async () => {
          let text = '';
          if (documentEngineAdapter) {
            const selection = await documentEngineAdapter.getSelection();
            text = selection.selectedText;
          } else if (editor) {
            text = selectedText.trim();
          }

          if (!text) {
            message.info('请先选中文本');
            return;
          }

          try {
            const config = getWritingConfig();

            const result = await polishText({
              originalText: text,
              style: 'formal',
              aiConfig: config as never,
            });

            (window as { __openTaskPane?: (tab?: 'assistant') => void }).__openTaskPane?.('assistant');
            (window as { __aiPreviewResult?: (text: string) => void }).__aiPreviewResult?.(result);
            message.success('润色结果已生成，请在右侧预览后应用');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '润色失败';
            message.error(errorMessage);
          }
        }}
      />
    </div>,
    document.body
  );
}

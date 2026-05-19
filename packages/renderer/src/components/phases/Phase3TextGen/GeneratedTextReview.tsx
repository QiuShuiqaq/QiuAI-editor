import { Button, Space, message, Alert } from 'antd';
import { CheckOutlined, EditOutlined, RedoOutlined } from '@ant-design/icons';
import { useEditorStore } from '../../../stores/useEditorStore';

interface GeneratedTextReviewProps {
  lastGeneratedText: string;
  sectionTitle: string;
  onAccept: () => void;
  onRegenerate: () => void;
  onClear: () => void;
}

export function GeneratedTextReview({
  lastGeneratedText,
  sectionTitle,
  onAccept,
  onRegenerate,
  onClear,
}: GeneratedTextReviewProps) {
  const editor = useEditorStore((s) => s.editor);

  const handleInsertToEditor = () => {
    if (editor && lastGeneratedText) {
      // Check if selection exists, otherwise insert at cursor
      editor.commands.insertContent(lastGeneratedText);
      message.success(`已插入"${sectionTitle}"的生成内容`);
      onAccept();
    }
  };

  return (
    <div style={{ marginTop: 8, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
        生成结果 — {sectionTitle}
      </div>

      {lastGeneratedText ? (
        <>
          <div
            style={{
              maxHeight: 250,
              overflow: 'auto',
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              padding: 8,
              background: '#fafafa',
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              marginBottom: 8,
            }}
          >
            {lastGeneratedText}
          </div>

          <Space size="small">
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={handleInsertToEditor}
            >
              插入编辑区
            </Button>
            <Button
              size="small"
              icon={<RedoOutlined />}
              onClick={onRegenerate}
            >
              重新生成
            </Button>
            <Button size="small" onClick={onClear}>
              放弃
            </Button>
          </Space>
        </>
      ) : (
        <Alert
          message="点击上方「全部生成」按钮，AI将为每个章节生成文本内容"
          type="info"
          showIcon
          style={{ fontSize: 12 }}
        />
      )}
    </div>
  );
}

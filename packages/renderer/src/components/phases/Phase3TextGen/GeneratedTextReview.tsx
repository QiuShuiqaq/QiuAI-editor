import { Alert, Button, Space, message } from 'antd';
import { CheckOutlined, RedoOutlined } from '@ant-design/icons';
import { insertDocumentText } from '../../../services/documentEngineCommands';

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
  const handleInsertToEditor = async () => {
    if (!lastGeneratedText) {
      return;
    }

    const applied = await insertDocumentText(lastGeneratedText);
    if (!applied) {
      message.error('当前文档无法插入生成内容');
      return;
    }

    message.success(`已将“${sectionTitle}”的生成内容插入正文`);
    onAccept();
  };

  return (
    <div style={{ marginTop: 8, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
        生成结果 - {sectionTitle || '当前章节'}
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
            <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => void handleInsertToEditor()}>
              插入编辑区
            </Button>
            <Button size="small" icon={<RedoOutlined />} onClick={onRegenerate}>
              重新生成
            </Button>
            <Button size="small" onClick={onClear}>
              放弃
            </Button>
          </Space>
        </>
      ) : (
        <Alert
          message="点击上方生成按钮后，AI 会先给出预览结果，再由你决定是否写入正文。"
          type="info"
          showIcon
          style={{ fontSize: 12 }}
        />
      )}
    </div>
  );
}

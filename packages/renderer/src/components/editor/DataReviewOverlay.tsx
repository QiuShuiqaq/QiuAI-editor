import { useState, useMemo } from 'react';
import { Button, List, Tag, Modal, Space, message } from 'antd';
import {
  AlertOutlined,
  CheckOutlined,
  EditOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useEditorStore } from '../../stores/useEditorStore';

interface ReviewItem {
  text: string;
  explanation: string;
  from: number;
  to: number;
}

export function DataReviewOverlay() {
  const [visible, setVisible] = useState(false);
  const editor = useEditorStore((s) => s.editor);

  // Extract REVIEW marks from editor content
  const reviewItems = useMemo((): ReviewItem[] => {
    if (!editor) return [];

    const items: ReviewItem[] = [];
    const content = editor.getJSON();
    const reviewRegex = /\[REVIEW:([^\]]*)\]([^\[]*)\[\/REVIEW\]/g;

    function walk(node: any) {
      if (!node) return;
      if (node.type === 'text' && node.text) {
        let match;
        while ((match = reviewRegex.exec(node.text)) !== null) {
          items.push({
            explanation: match[1],
            text: match[2],
            from: 0,
            to: 0,
          });
        }
      }
      if (node.content) {
        for (const child of node.content) {
          walk(child);
        }
      }
    }

    walk(content);
    return items;
  }, [editor, editor?.state]);

  const handleAccept = (item: ReviewItem) => {
    if (!editor) return;
    // Replace [REVIEW:xxx]text[/REVIEW] with just the text
    const fullMatch = `[REVIEW:${item.explanation}]${item.text}[/REVIEW]`;
    const { from, to } = editor.state.selection;

    // Search and replace in the editor content
    const docText = editor.getText();
    const idx = docText.indexOf(item.text);
    if (idx !== -1) {
      editor
        .chain()
        .focus()
        .setTextSelection({ from: idx, to: idx + fullMatch.length })
        .insertContent(item.text)
        .run();
    }

    message.success('已接受该数据');
  };

  const handleAcceptAll = () => {
    if (!editor) return;
    const docText = editor.getText();
    // Replace all REVIEW tags with just the content
    const cleaned = docText.replace(
      /\[REVIEW:[^\]]*\]([^\[]*)\[\/REVIEW\]/g,
      '$1'
    );
    editor.commands.setContent(
      cleaned
        .split('\n')
        .map((line) => (line.trim() ? `<p>${line}</p>` : ''))
        .join('')
    );
    message.success('已接受全部数据标记');
    setVisible(false);
  };

  return (
    <>
      <Button
        type="text"
        size="small"
        icon={<AlertOutlined />}
        onClick={() => setVisible(true)}
        style={{ color: reviewItems.length > 0 ? '#faad14' : undefined }}
      >
        {reviewItems.length > 0
          ? `数据审查 (${reviewItems.length})`
          : '数据审查'}
      </Button>

      <Modal
        title={
          <span>
            <AlertOutlined /> 数据审查面板
          </span>
        }
        open={visible}
        onCancel={() => setVisible(false)}
        footer={
          reviewItems.length > 0 ? (
            <Space>
              <Button onClick={() => setVisible(false)}>关闭</Button>
              <Button type="primary" icon={<CheckOutlined />} onClick={handleAcceptAll}>
                全部接受
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setVisible(false)}>关闭</Button>
          )
        }
        width={520}
      >
        {reviewItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
            <AlertOutlined style={{ fontSize: 32, marginBottom: 8 }} />
            <p>当前没有需要审查的数据标记</p>
            <p style={{ fontSize: 12 }}>
              AI生成内容中的关键数据会自动标记为黄色高亮
            </p>
          </div>
        ) : (
          <List
            dataSource={reviewItems}
            style={{ maxHeight: 400, overflow: 'auto' }}
            renderItem={(item, idx) => (
              <List.Item
                style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}
                actions={[
                  <Button
                    key="accept"
                    type="link"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={() => handleAccept(item)}
                  >
                    接受
                  </Button>,
                  <Button key="edit" type="link" size="small" icon={<EditOutlined />}>
                    编辑
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <span style={{ fontSize: 13 }}>
                      <Tag color="warning">{item.explanation}</Tag>
                    </span>
                  }
                  description={
                    <span style={{ fontSize: 12, color: '#333' }}>
                      {item.text}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </>
  );
}

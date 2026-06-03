import type { JSONContent } from '@tiptap/core';
import { useState, useMemo } from 'react';
import { Button, List, Tag, Modal, Space, message } from 'antd';
import {
  AlertOutlined,
  CheckOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { replaceDocumentContent } from '../../services/documentEngineCommands';
import { useEditorStore } from '../../stores/useEditorStore';

interface ReviewItem {
  id: string;
  text: string;
  explanation: string;
  markerText: string;
}

const REVIEW_PATTERN = /\[REVIEW:([^\]]*)\]([\s\S]*?)\[\/REVIEW\]/g;

function transformReviewNode(
  node: JSONContent | undefined,
  matcher: (fullMatch: string, explanation: string, text: string) => string
): JSONContent | undefined {
  if (!node) {
    return node;
  }

  const nextNode: JSONContent = {
    ...node,
  };

  if (typeof nextNode.text === 'string') {
    nextNode.text = nextNode.text.replace(
      REVIEW_PATTERN,
      (_fullMatch, explanation: string, text: string) =>
        matcher(String(_fullMatch), explanation, text)
    );
  }

  if (Array.isArray(nextNode.content)) {
    nextNode.content = nextNode.content
      .map((child) => transformReviewNode(child, matcher))
      .filter(Boolean) as JSONContent[];
  }

  return nextNode;
}

export function DataReviewOverlay() {
  const [visible, setVisible] = useState(false);
  const editor = useEditorStore((s) => s.editor);

  // Extract REVIEW marks from editor content
  const reviewItems = useMemo((): ReviewItem[] => {
    if (!editor) return [];

    const items: ReviewItem[] = [];
    const content = editor.getJSON();
    function walk(node: JSONContent | undefined) {
      if (!node) return;
      if (node.type === 'text' && node.text) {
        let match;
        while ((match = REVIEW_PATTERN.exec(node.text)) !== null) {
          items.push({
            id: `${match[1]}-${items.length}`,
            explanation: match[1],
            text: match[2],
            markerText: match[0],
          });
        }
        REVIEW_PATTERN.lastIndex = 0;
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
    let replaced = false;
    const cleaned = transformReviewNode(editor.getJSON() as JSONContent, (fullMatch, _explanation, text) => {
      if (!replaced && fullMatch === item.markerText) {
        replaced = true;
        return text;
      }
      return fullMatch;
    });

    if (!replaced || !cleaned) {
      message.warning('未找到对应的数据标记');
      return;
    }

    void replaceDocumentContent(cleaned).then((success) => {
      if (success) {
        message.success('已接受该数据');
        return;
      }
      message.error('接受数据标记失败');
    });
  };

  const handleAcceptAll = () => {
    if (!editor) return;
    const cleaned = transformReviewNode(editor.getJSON() as JSONContent, (_fullMatch, _explanation, text) => text);
    if (!cleaned) {
      message.warning('当前没有可处理的数据标记');
      return;
    }

    void replaceDocumentContent(cleaned).then((success) => {
      if (success) {
        message.success('已接受全部数据标记');
        setVisible(false);
        return;
      }
      message.error('批量接受数据标记失败');
    });
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
            renderItem={(item) => (
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

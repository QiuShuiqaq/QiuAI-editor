import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, message } from 'antd';
import { syncDocumentWithState } from '@qiuai/shared';
import { useProjectStore } from '../../stores/useProjectStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DocumentPropertiesDialog({ open, onClose }: Props) {
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [subject, setSubject] = useState('');
  const [keywords, setKeywords] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setTitle(doc.title || '');
    setAuthor(doc.documentState.documentMeta.author || '');
    setSubject(doc.documentState.documentMeta.subject || '');
    setKeywords(doc.documentState.documentMeta.keywords.join(', '));
  }, [doc, open]);

  const save = () => {
    setDoc(
      syncDocumentWithState({
        ...doc,
        title: title.trim() || doc.title,
        updatedAt: new Date().toISOString(),
        documentState: {
          ...doc.documentState,
          documentMeta: {
            author: author.trim(),
            subject: subject.trim(),
            keywords: keywords
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
          },
        },
      })
    );
    message.success('文档属性已保存');
    onClose();
  };

  return (
    <Modal title="文档属性" open={open} onCancel={onClose} footer={null} width={360}>
      <Form layout="vertical" size="small">
        <Form.Item label="标题">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Form.Item>
        <Form.Item label="作者">
          <Input value={author} onChange={(event) => setAuthor(event.target.value)} />
        </Form.Item>
        <Form.Item label="主题">
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
        </Form.Item>
        <Form.Item label="关键词">
          <Input.TextArea
            rows={2}
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
            placeholder="用逗号分隔"
          />
        </Form.Item>
        <Button type="primary" onClick={save}>
          保存
        </Button>
      </Form>
    </Modal>
  );
}

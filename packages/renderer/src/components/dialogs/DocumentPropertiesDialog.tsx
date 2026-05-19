import { useState } from 'react';
import { Modal, Input, Button, Form, message } from 'antd';
import { useProjectStore } from '../../stores/useProjectStore';

interface Props { open: boolean; onClose: () => void; }

export function DocumentPropertiesDialog({ open, onClose }: Props) {
  const doc = useProjectStore((s) => s.doc);
  const setDoc = useProjectStore((s) => s.setDoc);
  const [title, setTitle] = useState(doc.title || '');
  const [author, setAuthor] = useState((doc as any).author || '');
  const [subject, setSubject] = useState((doc as any).subject || '');
  const [keywords, setKeywords] = useState((doc as any).keywords || '');

  const save = () => {
    setDoc({ ...doc, title, author, subject, keywords } as any);
    message.success('文档属性已保存');
    onClose();
  };

  return (
    <Modal title="文档属性" open={open} onCancel={onClose} footer={null} width={360}>
      <Form layout="vertical" size="small">
        <Form.Item label="标题"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Form.Item>
        <Form.Item label="作者"><Input value={author} onChange={(e) => setAuthor(e.target.value)} /></Form.Item>
        <Form.Item label="主题"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Form.Item>
        <Form.Item label="关键词"><Input.TextArea rows={2} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="用逗号分隔"/></Form.Item>
        <Button type="primary" onClick={save}>保存</Button>
      </Form>
    </Modal>
  );
}

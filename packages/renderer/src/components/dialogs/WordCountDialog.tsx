import { Modal, Descriptions } from 'antd';
import { useEditorStore } from '../../stores/useEditorStore';

interface Props { open: boolean; onClose: () => void; }

export function WordCountDialog({ open, onClose }: Props) {
  const wordCount = useEditorStore((s) => s.wordCount);
  const editor = useEditorStore((s) => s.editor);
  const text = editor?.getText() || '';
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, '').length;
  const paragraphs = text.split(/\n+/).filter(l => l.trim()).length;
  const lines = Math.max(1, Math.ceil(chars / 40));
  // Count images & tables
  let imgCount = 0, tblCount = 0, headingCount = 0;
  editor?.state.doc.descendants((node) => {
    if (node.type.name === 'image' || node.type.name === 'imagePlaceholder') imgCount++;
    if (node.type.name === 'table' || node.type.name === 'tablePlaceholder') tblCount++;
    if (node.type.name === 'heading') headingCount++;
  });

  return (
    <Modal title="字数统计" open={open} onCancel={onClose} footer={null} width={380}>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="页数">{Math.max(1, Math.ceil(wordCount / 500))}</Descriptions.Item>
        <Descriptions.Item label="字数">{wordCount.toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="字符数(含空格)">{chars.toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="字符数(不含空格)">{charsNoSpaces.toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="段落数">{paragraphs}</Descriptions.Item>
        <Descriptions.Item label="行数(估算)">{lines}</Descriptions.Item>
        <Descriptions.Item label="标题数">{headingCount}</Descriptions.Item>
        <Descriptions.Item label="图片/表格">{imgCount}/{tblCount}</Descriptions.Item>
      </Descriptions>
    </Modal>
  );
}

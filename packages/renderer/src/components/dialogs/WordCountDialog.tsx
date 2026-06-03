import { Descriptions, Modal } from 'antd';
import { useEditorStore } from '../../stores/useEditorStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function WordCountDialog({ open, onClose }: Props) {
  const wordCount = useEditorStore((state) => state.wordCount);
  const pageCount = useEditorStore((state) => state.pageCount);
  const editor = useEditorStore((state) => state.editor);
  const text = editor?.getText() || '';
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, '').length;
  const paragraphs = text.split(/\n+/).filter((line) => line.trim()).length;
  const lines = Math.max(1, Math.ceil(chars / 40));

  let imgCount = 0;
  let tblCount = 0;
  let headingCount = 0;

  editor?.state.doc.descendants((node) => {
    if (node.type.name === 'image' || node.type.name === 'imagePlaceholder') imgCount += 1;
    if (node.type.name === 'table' || node.type.name === 'tablePlaceholder') tblCount += 1;
    if (node.type.name === 'heading') headingCount += 1;
  });

  return (
    <Modal title="字数统计" open={open} onCancel={onClose} footer={null} width={380}>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="页数">{pageCount}</Descriptions.Item>
        <Descriptions.Item label="字数">{wordCount.toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="字符数（含空格）">{chars.toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="字符数（不含空格）">{charsNoSpaces.toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="段落数">{paragraphs}</Descriptions.Item>
        <Descriptions.Item label="行数（估算）">{lines}</Descriptions.Item>
        <Descriptions.Item label="标题数">{headingCount}</Descriptions.Item>
        <Descriptions.Item label="图片/表格">{imgCount}/{tblCount}</Descriptions.Item>
      </Descriptions>
    </Modal>
  );
}

/**
 * Table of Contents — auto-generate from heading 1-3 nodes.
 * Inserts at editor cursor position.
 */
import { useState } from 'react';
import { Modal, Checkbox, Button, Space, message, Radio } from 'antd';
import { useEditorStore } from '../../stores/useEditorStore';

interface Props { open: boolean; onClose: () => void; }

export function TocDialog({ open, onClose }: Props) {
  const editor = useEditorStore((s) => s.editor);
  const [levels, setLevels] = useState([1, 2, 3]);
  const [withPageNums, setWithPageNums] = useState(true);

  const generate = () => {
    if (!editor) return;
    const headings: Array<{ level: number; text: string; pos: number }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && levels.includes(node.attrs.level)) {
        headings.push({ level: node.attrs.level, text: node.textContent, pos });
      }
    });

    if (headings.length === 0) { message.warning('未找到标题，请先设置标题样式'); return; }

    let toc = '<h1 style="text-align:center">目录</h1>';
    toc += '<p>&nbsp;</p>';

    for (const h of headings) {
      const indent = '&emsp;'.repeat(h.level - 1);
      const fontSize = h.level === 1 ? '16pt' : h.level === 2 ? '14pt' : '12pt';
      const pageEst = Math.max(1, Math.ceil(h.pos / 1500));
      toc += `<p style="font-size:${fontSize};margin:4px 0;text-indent:0">${indent}${h.text}${withPageNums ? `<span style="float:right;color:#999">${pageEst}</span>` : ''}</p>`;
    }

    editor.commands.insertContent(toc);
    message.success('目录已插入');
    onClose();
  };

  return (
    <Modal title="插入目录" open={open} onCancel={onClose} footer={null} width={340}>
      <div style={{ marginBottom: 12, fontSize: 12 }}>包含的标题级别：</div>
      <Checkbox.Group value={levels} onChange={(v) => setLevels(v as number[])}>
        <Space>
          <Checkbox value={1}>标题 1</Checkbox>
          <Checkbox value={2}>标题 2</Checkbox>
          <Checkbox value={3}>标题 3</Checkbox>
        </Space>
      </Checkbox.Group>
      <div style={{ margin: '12px 0' }}>
        <Checkbox checked={withPageNums} onChange={(e) => setWithPageNums(e.target.checked)}>显示页码</Checkbox>
      </div>
      <Button type="primary" block onClick={generate}>生成目录</Button>
    </Modal>
  );
}

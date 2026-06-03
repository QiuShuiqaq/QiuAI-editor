import { useMemo, useState } from 'react';
import { Button, Checkbox, Input, Modal, Space, message } from 'antd';
import { executeDocumentCommand } from '../../services/documentEngineCommands';
import { useDocumentEngineStore } from '../../stores/useDocumentEngineStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { buildTocEntries, extractDocumentReferences } from '../editor/documentReferenceUtils';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TocDialog({ open, onClose }: Props) {
  const editor = useEditorStore((state) => state.editor);
  const documentEngineAdapter = useDocumentEngineStore((state) => state.adapter);
  const [levels, setLevels] = useState([1, 2, 3]);
  const [withPageNums, setWithPageNums] = useState(true);
  const [title, setTitle] = useState('目录');

  const headings = useMemo(() => {
    if (!editor) {
      return [];
    }

    return extractDocumentReferences(editor.state.doc).headings.filter((heading) => levels.includes(heading.level));
  }, [editor, levels, open]);

  const generate = async () => {
    const success = await executeDocumentCommand('insert-toc', {
      title: title || '目录',
      levels,
      withPageNumbers: withPageNums,
    });

    if (success) {
      message.success('目录已插入');
      onClose();
      return;
    }

    if (!editor) {
      message.warning('当前没有可用的编辑器上下文。');
      return;
    }

    const entries = buildTocEntries(editor.state.doc, {
      title: title || '目录',
      levels,
      withPageNumbers: withPageNums,
    });

    if (entries.length === 0) {
      message.warning('未找到可生成目录的标题，请先设置标题样式。');
      return;
    }

    const existingPos: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tocBlock') {
        existingPos.push(pos);
      }
    });

    if (existingPos.length > 0) {
      editor
        .chain()
        .focus()
        .deleteRange({
          from: existingPos[0],
          to: existingPos[0] + editor.state.doc.nodeAt(existingPos[0])!.nodeSize,
        })
        .insertContentAt(existingPos[0], {
          type: 'tocBlock',
          attrs: {
            title: title || '目录',
            withPageNumbers: withPageNums,
            entries,
          },
        })
        .run();
      message.success('目录已更新');
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'tocBlock',
          attrs: {
            title: title || '目录',
            withPageNumbers: withPageNums,
            entries,
          },
        })
        .run();
      message.success('目录已插入');
    }

    onClose();
  };

  return (
    <Modal title="插入目录" open={open} onCancel={onClose} footer={null} width={360}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 6, fontSize: 12 }}>目录标题</div>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>

      <div style={{ marginBottom: 12, fontSize: 12 }}>包含的标题级别：</div>
      <Checkbox.Group value={levels} onChange={(value) => setLevels(value as number[])}>
        <Space>
          <Checkbox value={1}>标题 1</Checkbox>
          <Checkbox value={2}>标题 2</Checkbox>
          <Checkbox value={3}>标题 3</Checkbox>
        </Space>
      </Checkbox.Group>

      <div style={{ margin: '12px 0' }}>
        <Checkbox checked={withPageNums} onChange={(event) => setWithPageNums(event.target.checked)}>
          显示页码
        </Checkbox>
      </div>

      <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 12 }}>
        {documentEngineAdapter
          ? '目录会根据当前文档中的标题结构生成。'
          : '将基于当前文档中的标题 1-3 生成目录；如果文档中已有目录，这里会直接更新。'}
      </div>

      <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 12 }}>
        {documentEngineAdapter ? '目录项会跟随当前页面内容重新计算。' : `当前可生成 ${headings.length} 条目录项。`}
      </div>

      <Button type="primary" block onClick={() => void generate()}>
        生成目录
      </Button>
    </Modal>
  );
}

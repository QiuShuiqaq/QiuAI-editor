import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, List, Modal, Radio, Space, Typography, message } from 'antd';
import { insertDocumentLinkText } from '../../services/documentEngineCommands';
import { useEditorStore } from '../../stores/useEditorStore';
import { extractDocumentReferences, type DocumentReferenceKind } from '../editor/documentReferenceUtils';

type ReferenceKind = DocumentReferenceKind;

interface CrossReferenceDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CrossReferenceDialog({ open, onClose }: CrossReferenceDialogProps) {
  const editor = useEditorStore((state) => state.editor);
  const [kind, setKind] = useState<ReferenceKind>('heading');
  const [selectedId, setSelectedId] = useState('');

  const targets = useMemo(() => {
    if (!editor) {
      return [];
    }
    const summary = extractDocumentReferences(editor.state.doc);
    return [...summary.headings, ...summary.images, ...summary.tables];
  }, [editor, open]);

  const visibleTargets = targets.filter((target) => target.kind === kind);
  const selectedTarget = visibleTargets.find((target) => target.id === selectedId);

  useEffect(() => {
    const firstTarget = visibleTargets[0];
    setSelectedId((current) =>
      visibleTargets.some((target) => target.id === current) ? current : firstTarget?.id ?? ''
    );
  }, [visibleTargets]);

  const insert = async () => {
    if (!selectedTarget) {
      message.warning('请先选择一个引用目标。');
      return;
    }

    const applied = await insertDocumentLinkText({
      href: `#${selectedTarget.anchorId}`,
      text: selectedTarget.preview,
      label: selectedTarget.label,
    });
    if (!applied) {
      message.warning('当前插入位置无法加入交叉引用，请调整光标位置后重试。');
      return;
    }

    message.success('已插入交叉引用。');
    onClose();
  };

  return (
    <Modal title="插入交叉引用" open={open} onCancel={onClose} footer={null} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>引用类型</div>
          <Radio.Group value={kind} onChange={(event) => setKind(event.target.value as ReferenceKind)}>
            <Space wrap>
              <Radio.Button value="heading">章节</Radio.Button>
              <Radio.Button value="image">图片</Radio.Button>
              <Radio.Button value="table">表格</Radio.Button>
            </Space>
          </Radio.Group>
        </div>

        <div
          style={{
            minHeight: 240,
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          {visibleTargets.length === 0 ? (
            <div style={{ padding: 24 }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前类型下暂无可引用目标" />
            </div>
          ) : (
            <List
              dataSource={visibleTargets}
              renderItem={(item) => {
                const active = item.id === selectedTarget?.id;
                return (
                  <List.Item
                    onClick={() => setSelectedId(item.id)}
                    style={{
                      cursor: 'pointer',
                      padding: '12px 14px',
                      background: active ? '#eff6ff' : '#fff',
                      borderLeft: active ? '3px solid #1677ff' : '3px solid transparent',
                    }}
                  >
                    <List.Item.Meta
                      title={<Typography.Text strong={active}>{item.label}</Typography.Text>}
                      description={
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                          {item.preview} · 第 {item.page} 页
                        </span>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: '#fafafa',
            border: '1px solid #f0f0f0',
          }}
        >
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>插入预览</div>
          <div style={{ fontSize: 14, color: '#1f1f1f', minHeight: 22 }}>
            {selectedTarget?.preview ?? '请选择一个引用目标。'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={() => void insert()} disabled={!selectedTarget}>
            插入引用
          </Button>
        </div>
      </div>
    </Modal>
  );
}

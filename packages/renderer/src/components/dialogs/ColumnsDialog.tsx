import { useEffect, useState } from 'react';
import { Button, Checkbox, InputNumber, Modal, Radio, message } from 'antd';
import { syncDocumentWithState } from '@qiuai/shared';
import { useProjectStore } from '../../stores/useProjectStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ColumnsDialog({ open, onClose }: Props) {
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);
  const [count, setCount] = useState<1 | 2 | 3>(1);
  const [gap, setGap] = useState(12);
  const [withLine, setWithLine] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const columns = doc.documentState.pageLayout.columns;
    setCount(columns.count);
    setGap(columns.gap);
    setWithLine(columns.separator);
  }, [doc.documentState.pageLayout.columns, open]);

  const apply = () => {
    setDoc(
      syncDocumentWithState({
        ...doc,
        updatedAt: new Date().toISOString(),
        documentState: {
          ...doc.documentState,
          pageLayout: {
            ...doc.documentState.pageLayout,
            columns: {
              count,
              gap: count === 1 ? 12 : gap,
              separator: count === 1 ? false : withLine,
            },
          },
        },
      })
    );

    message.success(count === 1 ? '已恢复为单栏排版' : `已切换为 ${count} 栏排版`);
    onClose();
  };

  return (
    <Modal title="分栏" open={open} onCancel={onClose} footer={null} width={340}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>栏数</label>
        <Radio.Group value={count} onChange={(event) => setCount(event.target.value as 1 | 2 | 3)} size="small">
          <Radio.Button value={1}>单栏</Radio.Button>
          <Radio.Button value={2}>双栏</Radio.Button>
          <Radio.Button value={3}>三栏</Radio.Button>
        </Radio.Group>
      </div>

      {count > 1 ? (
        <>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, display: 'block' }}>栏间距 (mm)</label>
            <InputNumber
              size="small"
              min={4}
              max={30}
              value={gap}
              onChange={(value) => setGap(value || 12)}
              style={{ width: '100%' }}
            />
          </div>
          <Checkbox
            checked={withLine}
            onChange={(event) => setWithLine(event.target.checked)}
            style={{ fontSize: 12, marginBottom: 12 }}
          >
            显示分隔线
          </Checkbox>
        </>
      ) : null}

      <Button type="primary" block onClick={apply}>
        应用
      </Button>
    </Modal>
  );
}

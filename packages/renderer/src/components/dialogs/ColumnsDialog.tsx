/**
 * ColumnsDialog — Multi-column layout like Word.
 */
import { useState } from 'react';
import { Modal, Radio, InputNumber, Checkbox, Button, Space, message } from 'antd';

interface Props { open: boolean; onClose: () => void; }

export function ColumnsDialog({ open, onClose }: Props) {
  const [count, setCount] = useState(1);
  const [gap, setGap] = useState(12); // mm
  const [withLine, setWithLine] = useState(false);

  const apply = () => {
    const style = document.documentElement.style;
    if (count === 1) {
      style.setProperty('--editor-columns', '1');
      style.setProperty('--editor-column-gap', '0');
      style.setProperty('--editor-column-rule', 'none');
    } else {
      style.setProperty('--editor-columns', String(count));
      style.setProperty('--editor-column-gap', `${gap}mm`);
      style.setProperty('--editor-column-rule', withLine ? '1px solid #ccc' : 'none');
    }
    message.success(count === 1 ? '已设为单栏' : `已设为${count}栏`);
    onClose();
  };

  return (
    <Modal title="分栏" open={open} onCancel={onClose} footer={null} width={340}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>栏数</label>
        <Radio.Group value={count} onChange={(e) => setCount(e.target.value)} size="small">
          <Radio.Button value={1}>一栏</Radio.Button>
          <Radio.Button value={2}>两栏</Radio.Button>
          <Radio.Button value={3}>三栏</Radio.Button>
        </Radio.Group>
      </div>
      {count > 1 && (<>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12, display: 'block' }}>栏间距 (mm)</label>
          <InputNumber size="small" min={4} max={30} value={gap} onChange={(v) => setGap(v||12)} style={{ width: '100%' }} />
        </div>
        <Checkbox checked={withLine} onChange={(e) => setWithLine(e.target.checked)} style={{ fontSize: 12, marginBottom: 12 }}>
          显示分隔线
        </Checkbox>
      </>)}
      <Button type="primary" block onClick={apply}>应用</Button>
    </Modal>
  );
}

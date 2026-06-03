import { useEffect, useState } from 'react';
import { Button, InputNumber, Modal, Radio, message } from 'antd';
import { syncDocumentWithState } from '@qiuai/shared';
import { useProjectStore } from '../../stores/useProjectStore';

interface PageSetupProps {
  open: boolean;
  onClose: () => void;
}

const PRESETS: Record<'normal' | 'narrow' | 'wide', { top: number; bottom: number; left: number; right: number }> = {
  normal: { top: 25.4, bottom: 25.4, left: 31.7, right: 31.7 },
  narrow: { top: 12.7, bottom: 12.7, left: 12.7, right: 12.7 },
  wide: { top: 25.4, bottom: 25.4, left: 50.8, right: 50.8 },
};

export function PageSetupDialog({ open, onClose }: PageSetupProps) {
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);
  const pageLayout = doc.documentState.pageLayout;

  const [preset, setPreset] = useState<'normal' | 'narrow' | 'wide' | 'custom'>('normal');
  const [top, setTop] = useState(25.4);
  const [bottom, setBottom] = useState(25.4);
  const [left, setLeft] = useState(31.7);
  const [right, setRight] = useState(31.7);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    if (!open) return;
    setPreset(pageLayout.preset);
    setTop(pageLayout.margins.top);
    setBottom(pageLayout.margins.bottom);
    setLeft(pageLayout.margins.left);
    setRight(pageLayout.margins.right);
    setOrientation(pageLayout.orientation);
  }, [open, pageLayout]);

  const applyPreset = (value: 'normal' | 'narrow' | 'wide' | 'custom') => {
    setPreset(value);
    if (value === 'custom') return;

    const next = PRESETS[value];
    setTop(next.top);
    setBottom(next.bottom);
    setLeft(next.left);
    setRight(next.right);
  };

  const apply = () => {
    document.documentElement.style.setProperty('--page-margin-top', `${top}mm`);
    document.documentElement.style.setProperty('--page-margin-bottom', `${bottom}mm`);
    document.documentElement.style.setProperty('--page-margin-left', `${left}mm`);
    document.documentElement.style.setProperty('--page-margin-right', `${right}mm`);
    document.documentElement.style.setProperty('--page-orientation', orientation);

    setDoc(
      syncDocumentWithState({
        ...doc,
        updatedAt: new Date().toISOString(),
        documentState: {
          ...doc.documentState,
          pageLayout: {
            ...doc.documentState.pageLayout,
            preset,
            orientation,
            margins: { top, bottom, left, right },
          },
        },
      })
    );

    message.success('页面设置已应用');
    onClose();
  };

  return (
    <Modal title="页面设置" open={open} onCancel={onClose} footer={null} width={400}>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>页边距预设</label>
        <Radio.Group value={preset} onChange={(event) => applyPreset(event.target.value)} size="small">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Radio value="normal">普通：上下 25.4mm，左右 31.7mm</Radio>
            <Radio value="narrow">窄：上下左右 12.7mm</Radio>
            <Radio value="wide">宽：上下 25.4mm，左右 50.8mm</Radio>
            <Radio value="custom">自定义</Radio>
          </div>
        </Radio.Group>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>上边距（mm）</label>
          <InputNumber
            size="small"
            value={top}
            min={5}
            max={60}
            style={{ width: '100%' }}
            onChange={(value) => {
              setPreset('custom');
              setTop(value || 0);
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>下边距（mm）</label>
          <InputNumber
            size="small"
            value={bottom}
            min={5}
            max={60}
            style={{ width: '100%' }}
            onChange={(value) => {
              setPreset('custom');
              setBottom(value || 0);
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>左边距（mm）</label>
          <InputNumber
            size="small"
            value={left}
            min={5}
            max={70}
            style={{ width: '100%' }}
            onChange={(value) => {
              setPreset('custom');
              setLeft(value || 0);
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>右边距（mm）</label>
          <InputNumber
            size="small"
            value={right}
            min={5}
            max={70}
            style={{ width: '100%' }}
            onChange={(value) => {
              setPreset('custom');
              setRight(value || 0);
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>纸张方向</label>
        <Radio.Group value={orientation} onChange={(event) => setOrientation(event.target.value)} size="small">
          <Radio.Button value="portrait">纵向</Radio.Button>
          <Radio.Button value="landscape">横向</Radio.Button>
        </Radio.Group>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={apply}>
          应用
        </Button>
      </div>
    </Modal>
  );
}

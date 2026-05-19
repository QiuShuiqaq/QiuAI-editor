import { useState } from 'react';
import { Modal, Radio, InputNumber, Button, Space, message } from 'antd';

interface PageSetupProps { open: boolean; onClose: () => void; }

const PRESETS: Record<string, { top: number; bottom: number; left: number; right: number }> = {
  normal: { top: 25.4, bottom: 25.4, left: 31.7, right: 31.7 },
  narrow: { top: 12.7, bottom: 12.7, left: 12.7, right: 12.7 },
  wide: { top: 25.4, bottom: 25.4, left: 50.8, right: 50.8 },
};

export function PageSetupDialog({ open, onClose }: PageSetupProps) {
  const [preset, setPreset] = useState('normal');
  const [top, setTop] = useState(25.4);
  const [bottom, setBottom] = useState(25.4);
  const [left, setLeft] = useState(31.7);
  const [right, setRight] = useState(31.7);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const applyPreset = (key: string) => {
    setPreset(key);
    const p = PRESETS[key];
    if (p) { setTop(p.top); setBottom(p.bottom); setLeft(p.left); setRight(p.right); }
  };

  const apply = () => {
    const root = document.documentElement.style;
    root.setProperty('--page-margin-top', top + 'mm');
    root.setProperty('--page-margin-bottom', bottom + 'mm');
    root.setProperty('--page-margin-left', left + 'mm');
    root.setProperty('--page-margin-right', right + 'mm');
    message.success('页面设置已应用');
    onClose();
  };

  return (
    <Modal title="页面设置" open={open} onCancel={onClose} footer={null} width={380}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>页边距预设</label>
        <Radio.Group value={preset} onChange={(e) => applyPreset(e.target.value)} size="small">
          <Space direction="vertical">
            <Radio value="normal">普通 — 上/下 2.54cm 左/右 3.17cm</Radio>
            <Radio value="narrow">窄 — 上下左右 1.27cm</Radio>
            <Radio value="wide">宽 — 上/下 2.54cm 左/右 5.08cm</Radio>
            <Radio value="custom">自定义</Radio>
          </Space>
        </Radio.Group>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div><label style={{ fontSize: 11 }}>上 (mm)</label><InputNumber size="small" value={top} onChange={(v) => { setPreset('custom'); setTop(v||0); }} min={5} max={50} style={{width:'100%'}} /></div>
        <div><label style={{ fontSize: 11 }}>下 (mm)</label><InputNumber size="small" value={bottom} onChange={(v) => { setPreset('custom'); setBottom(v||0); }} min={5} max={50} style={{width:'100%'}} /></div>
        <div><label style={{ fontSize: 11 }}>左 (mm)</label><InputNumber size="small" value={left} onChange={(v) => { setPreset('custom'); setLeft(v||0); }} min={5} max={60} style={{width:'100%'}} /></div>
        <div><label style={{ fontSize: 11 }}>右 (mm)</label><InputNumber size="small" value={right} onChange={(v) => { setPreset('custom'); setRight(v||0); }} min={5} max={60} style={{width:'100%'}} /></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>纸张方向</label>
        <Radio.Group value={orientation} onChange={(e) => setOrientation(e.target.value)} size="small">
          <Radio.Button value="portrait">纵向</Radio.Button>
          <Radio.Button value="landscape">横向</Radio.Button>
        </Radio.Group>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={apply}>应用</Button>
      </div>
    </Modal>
  );
}

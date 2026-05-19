/**
 * PrintPreview — Full print preview with multi-page thumbnails.
 */
import { useState } from 'react';
import { Modal, Button, Space, Slider, message } from 'antd';
import { PrinterOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { useEditorStore } from '../../stores/useEditorStore';

interface Props { open: boolean; onClose: () => void; }

export function PrintPreview({ open, onClose }: Props) {
  const [scale, setScale] = useState(60);
  const editor = useEditorStore((s) => s.editor);
  const wordCount = useEditorStore((s) => s.wordCount);
  const pages = Math.max(1, Math.ceil(wordCount / 500));

  const print = () => { window.print(); message.success('已发送到打印机'); };

  return (
    <Modal title="打印预览" open={open} onCancel={onClose} width={900} style={{ top: 20 }}
      footer={<Space><Button onClick={onClose}>关闭</Button><Button type="primary" icon={<PrinterOutlined />} onClick={print}>打印</Button></Space>}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Button size="small" icon={<ZoomOutOutlined />} onClick={() => setScale(Math.max(30, scale - 10))} />
        <Slider min={30} max={120} step={10} value={scale} onChange={setScale} style={{ width: 150 }} tooltip={{ formatter: (v) => `${v}%` }} />
        <Button size="small" icon={<ZoomInOutlined />} onClick={() => setScale(Math.min(120, scale + 10))} />
        <span style={{ fontSize: 12 }}>{scale}%</span>
      </div>
      <div style={{ background: '#999', padding: 16, display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', minHeight: 400 }}>
        {Array.from({ length: pages }, (_, i) => (
          <div key={i} style={{
            width: `${210 * scale / 100}mm`, minHeight: `${297 * scale / 100}mm`,
            background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', padding: `${12 * scale / 100}mm`,
            fontSize: `${8 * scale / 100}pt`, color: '#333',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}>
            <div style={{ textAlign: 'center', color: '#bbb', fontSize: `${7 * scale / 100}pt` }}>
              {i + 1}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

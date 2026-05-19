/**
 * WatermarkDialog — Add page background watermark.
 * Supports text watermark with custom content, color, opacity, rotation.
 */
import { useState } from 'react';
import { Modal, Input, ColorPicker, Slider, Button, Space, Radio, message } from 'antd';

interface Props { open: boolean; onClose: () => void; }

export function WatermarkDialog({ open, onClose }: Props) {
  const [text, setText] = useState('草稿');
  const [color, setColor] = useState('#d0d0d0');
  const [opacity, setOpacity] = useState(15);
  const [rotation, setRotation] = useState(-30);
  const [preset, setPreset] = useState('draft');

  const presets: Record<string, { text: string; color: string }> = {
    draft: { text: '草稿', color: '#d0d0d0' },
    confidential: { text: '机密', color: '#ff4d4f' },
    sample: { text: '样本', color: '#1677ff' },
    doNotCopy: { text: '严禁复制', color: '#faad14' },
  };

  const applyPreset = (key: string) => {
    setPreset(key);
    const p = presets[key];
    if (p) { setText(p.text); setColor(p.color); }
  };

  const apply = () => {
    // Set watermark as CSS custom property on editor container
    document.documentElement.style.setProperty('--watermark-text', `"${text}"`);
    document.documentElement.style.setProperty('--watermark-color', color);
    document.documentElement.style.setProperty('--watermark-opacity', String(opacity / 100));
    document.documentElement.style.setProperty('--watermark-rotation', `${rotation}deg`);
    document.documentElement.style.setProperty('--watermark-display', 'block');
    message.success('水印已应用');
    onClose();
  };

  const remove = () => {
    document.documentElement.style.setProperty('--watermark-display', 'none');
    message.success('水印已移除');
    onClose();
  };

  return (
    <Modal title="水印" open={open} onCancel={onClose} footer={null} width={380}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>预设</label>
        <Radio.Group value={preset} onChange={(e) => applyPreset(e.target.value)} size="small">
          <Radio.Button value="draft">草稿</Radio.Button>
          <Radio.Button value="confidential">机密</Radio.Button>
          <Radio.Button value="sample">样本</Radio.Button>
          <Radio.Button value="doNotCopy">严禁复制</Radio.Button>
        </Radio.Group>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, display: 'block' }}>文字</label>
        <Input size="small" value={text} onChange={(e) => { setText(e.target.value); setPreset(''); }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, display: 'block' }}>颜色</label>
        <ColorPicker size="small" value={color} onChange={(c) => setColor(c.toHexString())} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, display: 'block' }}>透明度: {opacity}%</label>
        <Slider min={5} max={40} value={opacity} onChange={setOpacity} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, display: 'block' }}>角度: {rotation}°</label>
        <Slider min={-80} max={80} value={rotation} onChange={setRotation} />
      </div>
      <Space>
        <Button type="primary" size="small" onClick={apply}>应用水印</Button>
        <Button size="small" onClick={remove}>移除水印</Button>
      </Space>
    </Modal>
  );
}

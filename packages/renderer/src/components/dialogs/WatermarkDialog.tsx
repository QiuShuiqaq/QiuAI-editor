import { useEffect, useState } from 'react';
import { Button, ColorPicker, Input, Modal, Radio, Slider, Space, message } from 'antd';
import { syncDocumentWithState } from '@qiuai/shared';
import { useProjectStore } from '../../stores/useProjectStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function WatermarkDialog({ open, onClose }: Props) {
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);
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

  useEffect(() => {
    if (!open) {
      return;
    }

    const watermark = doc.documentState.pageLayout.watermark;
    setText(watermark.text || '草稿');
    setColor(watermark.color || '#d0d0d0');
    setOpacity(Math.round((watermark.opacity || 0.15) * 100));
    setRotation(watermark.rotation || -30);
  }, [doc.documentState.pageLayout.watermark, open]);

  const applyPreset = (key: string) => {
    setPreset(key);
    const nextPreset = presets[key];
    if (!nextPreset) {
      return;
    }

    setText(nextPreset.text);
    setColor(nextPreset.color);
  };

  const apply = () => {
    setDoc(
      syncDocumentWithState({
        ...doc,
        updatedAt: new Date().toISOString(),
        documentState: {
          ...doc.documentState,
          pageLayout: {
            ...doc.documentState.pageLayout,
            watermark: {
              enabled: true,
              text: text.trim() || '草稿',
              color,
              opacity: opacity / 100,
              rotation,
            },
          },
        },
      })
    );
    message.success('水印已应用');
    onClose();
  };

  const remove = () => {
    setDoc(
      syncDocumentWithState({
        ...doc,
        updatedAt: new Date().toISOString(),
        documentState: {
          ...doc.documentState,
          pageLayout: {
            ...doc.documentState.pageLayout,
            watermark: {
              ...doc.documentState.pageLayout.watermark,
              enabled: false,
            },
          },
        },
      })
    );
    message.success('水印已移除');
    onClose();
  };

  return (
    <Modal title="水印" open={open} onCancel={onClose} footer={null} width={380}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>预设</label>
        <Radio.Group value={preset} onChange={(event) => applyPreset(event.target.value)} size="small">
          <Radio.Button value="draft">草稿</Radio.Button>
          <Radio.Button value="confidential">机密</Radio.Button>
          <Radio.Button value="sample">样本</Radio.Button>
          <Radio.Button value="doNotCopy">严禁复制</Radio.Button>
        </Radio.Group>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, display: 'block' }}>文字</label>
        <Input
          size="small"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setPreset('');
          }}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, display: 'block' }}>颜色</label>
        <ColorPicker size="small" value={color} onChange={(value) => setColor(value.toHexString())} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, display: 'block' }}>透明度 {opacity}%</label>
        <Slider min={5} max={40} value={opacity} onChange={(value) => setOpacity(Number(value))} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, display: 'block' }}>角度 {rotation}°</label>
        <Slider min={-80} max={80} value={rotation} onChange={(value) => setRotation(Number(value))} />
      </div>
      <Space>
        <Button type="primary" size="small" onClick={apply}>
          应用水印
        </Button>
        <Button size="small" onClick={remove}>
          移除水印
        </Button>
      </Space>
    </Modal>
  );
}

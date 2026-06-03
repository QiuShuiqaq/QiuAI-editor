import { useEffect, useState } from 'react';
import { Button, ColorPicker, InputNumber, Modal, Radio, Select, message } from 'antd';
import { syncDocumentWithState } from '@qiuai/shared';
import { useProjectStore } from '../../stores/useProjectStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PageBorderDialog({ open, onClose }: Props) {
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);
  const [mode, setMode] = useState<'none' | 'box' | 'shadow'>('box');
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(1);
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted' | 'double'>('solid');

  useEffect(() => {
    if (!open) {
      return;
    }

    const pageBorder = doc.documentState.pageLayout.pageBorder;
    setMode(pageBorder.mode);
    setColor(pageBorder.color);
    setWidth(pageBorder.width);
    setLineStyle(pageBorder.lineStyle);
  }, [doc.documentState.pageLayout.pageBorder, open]);

  const apply = () => {
    setDoc(
      syncDocumentWithState({
        ...doc,
        updatedAt: new Date().toISOString(),
        documentState: {
          ...doc.documentState,
          pageLayout: {
            ...doc.documentState.pageLayout,
            pageBorder: {
              mode,
              color,
              width,
              lineStyle,
            },
          },
        },
      })
    );
    message.success('页面边框已应用');
    onClose();
  };

  return (
    <Modal title="页面边框" open={open} onCancel={onClose} footer={null} width={360}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>边框类型</label>
        <Radio.Group value={mode} onChange={(event) => setMode(event.target.value)} size="small">
          <Radio.Button value="none">无</Radio.Button>
          <Radio.Button value="box">方框</Radio.Button>
          <Radio.Button value="shadow">阴影</Radio.Button>
        </Radio.Group>
      </div>

      {mode !== 'none' ? (
        <>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, display: 'block' }}>颜色</label>
            <ColorPicker size="small" value={color} onChange={(value) => setColor(value.toHexString())} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, display: 'block' }}>粗细 (pt)</label>
            <InputNumber
              size="small"
              min={0.5}
              max={6}
              step={0.5}
              value={width}
              onChange={(value) => setWidth(value || 1)}
              style={{ width: '100%' }}
            />
          </div>
          {mode === 'box' ? (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, display: 'block' }}>线型</label>
              <Select
                size="small"
                value={lineStyle}
                onChange={setLineStyle}
                style={{ width: '100%' }}
                options={[
                  { value: 'solid', label: '实线' },
                  { value: 'dashed', label: '虚线' },
                  { value: 'dotted', label: '点线' },
                  { value: 'double', label: '双线' },
                ]}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <Button type="primary" block onClick={apply}>
        应用
      </Button>
    </Modal>
  );
}

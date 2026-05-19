/** PageBorderDialog — page-level border settings */
import { useState } from 'react';
import { Modal, Radio, Select, ColorPicker, InputNumber, Button, Space, message } from 'antd';

interface Props { open: boolean; onClose: () => void; }

export function PageBorderDialog({ open, onClose }: Props) {
  const [style, setStyle] = useState<'none'|'box'|'shadow'>('box');
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(1);
  const [borderStyle, setBorderStyle] = useState<'solid'|'dashed'|'dotted'|'double'>('solid');

  const apply = () => {
    const s = document.documentElement.style;
    if (style === 'none') {
      s.setProperty('--page-border', 'none');
    } else if (style === 'box') {
      s.setProperty('--page-border', `${width}pt ${borderStyle} ${color}`);
      s.setProperty('--page-border-shadow', 'none');
    } else {
      s.setProperty('--page-border', 'none');
      s.setProperty('--page-border-shadow', `0 0 ${width*4}px ${color}`);
    }
    message.success('页面边框已应用');
    onClose();
  };

  return (
    <Modal title="页面边框" open={open} onCancel={onClose} footer={null} width={360}>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:12,display:'block',marginBottom:4}}>边框类型</label>
        <Radio.Group value={style} onChange={(e)=>setStyle(e.target.value)} size="small">
          <Radio.Button value="none">无</Radio.Button>
          <Radio.Button value="box">方框</Radio.Button>
          <Radio.Button value="shadow">阴影</Radio.Button>
        </Radio.Group>
      </div>
      {style !== 'none' && <>
        <div style={{marginBottom:8}}>
          <label style={{fontSize:12,display:'block'}}>颜色</label>
          <ColorPicker size="small" value={color} onChange={(c)=>setColor(c.toHexString())} />
        </div>
        <div style={{marginBottom:8}}>
          <label style={{fontSize:12,display:'block'}}>粗细 (pt)</label>
          <InputNumber size="small" min={0.5} max={6} step={0.5} value={width} onChange={(v)=>setWidth(v||1)} style={{width:'100%'}} />
        </div>
        {style === 'box' && <div style={{marginBottom:12}}>
          <label style={{fontSize:12,display:'block'}}>线型</label>
          <Select size="small" value={borderStyle} onChange={setBorderStyle} style={{width:'100%'}}
            options={[{v:'solid',l:'实线'},{v:'dashed',l:'虚线'},{v:'dotted',l:'点线'},{v:'double',l:'双线'}]} />
        </div>}
      </>}
      <Button type="primary" block onClick={apply}>应用</Button>
    </Modal>
  );
}

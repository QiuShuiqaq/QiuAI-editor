import { useState } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { ZoomControl } from '../editor/ZoomControl';
import { WordCountDialog } from '../dialogs/WordCountDialog';
import { Button } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

interface StatusBarProps {
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  outlineVisible?: boolean;
  onToggleOutline?: () => void;
}

export function StatusBar({ zoom = 1, onZoomChange, outlineVisible, onToggleOutline }: StatusBarProps) {
  const wordCount = useEditorStore((s) => s.wordCount);
  const isDirty = useEditorStore((s) => s.isDirty);
  const pages = Math.max(1, Math.ceil(wordCount / 500));
  const [wcOpen, setWcOpen] = useState(false);

  return (<>
    <div style={{
      height: 26, background: '#f0f0f0', borderTop: '1px solid #d0d0d0',
      display: 'flex', alignItems: 'center', padding: '0 8px',
      fontSize: 12, color: '#666', gap: 8,
    }}>
      <span>第 {pages} 页，共 {pages} 页</span>
      <span style={{ color: '#d0d0d0' }}>|</span>
      <span style={{ cursor: 'pointer' }} onClick={() => setWcOpen(true)} title="点击查看详细统计">
        {wordCount.toLocaleString()} 个字
      </span>

      <span style={{ flex: 1 }} />

      <Button type="text" size="small" icon={<FileTextOutlined />}
        onClick={onToggleOutline}
        style={{ height: 22, fontSize: 11, color: outlineVisible ? '#1677ff' : '#666' }}>
        大纲
      </Button>

      <div style={{ borderLeft: '1px solid #d0d0d0', paddingLeft: 8 }}>
        <ZoomControl zoom={zoom * 100} onChange={(z) => onZoomChange?.(z / 100)} />
      </div>

      <span style={{ color: isDirty ? '#faad14' : '#52c41a', fontSize: 11 }}>
        {isDirty ? '● 未保存' : '✓ 已保存'}
      </span>
    </div>
    <WordCountDialog open={wcOpen} onClose={() => setWcOpen(false)} />
  </>);
}

import { useState, useEffect } from 'react';
import { Button, Tooltip } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { RibbonToolbar } from './RibbonToolbar';
import { OutlineSidebar } from './OutlineSidebar';
import { EditorArea } from './EditorArea';
import { RightPanel } from './RightPanel';
import { AgentPanel } from './AgentPanel';
import { StatusBar } from './StatusBar';

const OUTLINE_WIDTH = 220;
export function AppShell() {
  const [zoom, setZoom] = useState(1);
  const [outlineVisible, setOutlineVisible] = useState(true);
  const [readingMode, setReadingMode] = useState(false);

  // Expose callbacks for Ribbon buttons (via window)
  useEffect(() => {
    (window as any).__toggleOutline = () => setOutlineVisible(v => !v);
    (window as any).__toggleReadingMode = () => setReadingMode(v => !v);
    const f11 = (e: KeyboardEvent) => { if (e.key === 'F11') { e.preventDefault(); setReadingMode(v => !v); } };
    window.addEventListener('keydown', f11);
    return () => { delete (window as any).__toggleOutline; delete (window as any).__toggleRightPanel; delete (window as any).__toggleReadingMode; window.removeEventListener('keydown', f11); };
  }, []);

  return (
    <div className={readingMode ? 'reading-mode' : ''} style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: '"Microsoft YaHei","微软雅黑",sans-serif' }}>
      {/* Ribbon — hidden in reading mode */}
      {!readingMode && <RibbonToolbar />}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left outline — hidden in reading mode */}
        {!readingMode && outlineVisible && (
          <div style={{ width: OUTLINE_WIDTH, minWidth: OUTLINE_WIDTH, borderRight: '1px solid #d0d0d0', overflow: 'auto', background: '#fafafa' }}>
            <OutlineSidebar />
          </div>
        )}

        {/* Center editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {!readingMode && !outlineVisible && (
            <Tooltip title="显示大纲"><Button type="text" size="small" icon={<MenuUnfoldOutlined />} onClick={() => setOutlineVisible(true)}
              style={{ position: 'absolute', left: 4, top: 4, zIndex: 10, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} /></Tooltip>
          )}
          <EditorArea zoom={zoom} />
        </div>

        {/* Right panels — two fixed non-collapsible panels */}
        {!readingMode && (
          <>
            <div style={{ width: 200, minWidth: 200, overflow: 'hidden' }}>
              <RightPanel />
            </div>
            <div style={{ width: 220, minWidth: 220, overflow: 'hidden' }}>
              <AgentPanel />
            </div>
          </>
        )}
      </div>

      {/* Status Bar — hidden in reading mode */}
      {!readingMode && <StatusBar zoom={zoom} onZoomChange={setZoom} outlineVisible={outlineVisible} onToggleOutline={() => setOutlineVisible(!outlineVisible)} />}
    </div>
  );
}

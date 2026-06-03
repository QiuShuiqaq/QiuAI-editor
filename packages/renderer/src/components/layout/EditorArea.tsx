import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { EditOutlined, LineOutlined } from '@ant-design/icons';
import { useEditorStore } from '../../stores/useEditorStore';
import { usePageViewStore } from '../../stores/usePageViewStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { EditorRuler } from '../editor/EditorRuler';
import { EditorContextMenu } from '../editor/EditorContextMenu';
import { FindReplacePanel } from '../editor/FindReplacePanel';
import { MiniToolbar } from '../editor/MiniToolbar';
import { DocumentEngineHost } from './DocumentEngineHost';

interface EditorAreaProps {
  zoom?: number;
}

const MM_TO_PX = 96 / 25.4;

function HeaderFooterModeBar() {
  const pageEditMode = usePageViewStore((state) => state.editMode);
  const setEditMode = usePageViewStore((state) => state.setEditMode);

  if (pageEditMode === 'none') {
    return null;
  }

  const currentLabel = pageEditMode === 'header' ? '页眉' : '页脚';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 16px',
        background: 'linear-gradient(180deg, #f7fbff 0%, #eef6ff 100%)',
        borderBottom: '1px solid #cfe1ff',
        boxShadow: '0 1px 0 rgba(22,119,255,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1677ff',
            color: '#fff',
          }}
        >
          <EditOutlined />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1f1f1f' }}>页眉和页脚</div>
          <div style={{ fontSize: 12, color: '#5b6b82' }}>
            {`当前正在编辑${currentLabel}，可双击页面区域直接修改，按 Esc 快速退出。`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button
          size="small"
          type={pageEditMode === 'header' ? 'primary' : 'default'}
          onClick={() => setEditMode('header')}
        >
          编辑页眉
        </Button>
        <Button
          size="small"
          type={pageEditMode === 'footer' ? 'primary' : 'default'}
          onClick={() => setEditMode('footer')}
        >
          编辑页脚
        </Button>
        <Button size="small" icon={<LineOutlined />} onClick={() => setEditMode('none')}>
          关闭页眉和页脚
        </Button>
      </div>
    </div>
  );
}

export function EditorArea({ zoom = 1 }: EditorAreaProps) {
  const [findVisible, setFindVisible] = useState(false);
  const [replaceVisible, setReplaceVisible] = useState(false);
  const pageEditMode = usePageViewStore((state) => state.editMode);
  const setEditMode = usePageViewStore((state) => state.setEditMode);
  const pageCount = useEditorStore((state) => state.pageCount);
  const setCurrentPage = useEditorStore((state) => state.setCurrentPage);
  const pageLayout = useProjectStore((state) => state.doc.documentState.pageLayout);
  const scrollHostRef = useRef<HTMLDivElement | null>(null);

  const syncPageFromScroll = useCallback(() => {
    const host = scrollHostRef.current;
    if (!host) return;

    const pageHeightMm = pageLayout.orientation === 'landscape' ? 210 : 297;
    const pageHeightPx = Math.max(pageHeightMm * zoom * MM_TO_PX, 1);
    const focusOffset = Math.max(
      0,
      host.scrollTop + host.clientHeight * 0.35 - pageLayout.margins.top * zoom * MM_TO_PX
    );
    const activePage = Math.max(
      1,
      Math.min(pageCount, Math.floor(focusOffset / pageHeightPx) + 1)
    );
    setCurrentPage(activePage);
  }, [pageCount, pageLayout.margins.top, pageLayout.orientation, setCurrentPage, zoom]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && usePageViewStore.getState().editMode !== 'none') {
        setEditMode('none');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setEditMode]);

  useEffect(() => {
    syncPageFromScroll();
  }, [pageCount, syncPageFromScroll]);

  if (typeof window !== 'undefined') {
    (window as { __editorShowFind?: () => void }).__editorShowFind = () => {
      setFindVisible(true);
      setReplaceVisible(false);
    };
    (window as { __editorShowReplace?: () => void }).__editorShowReplace = () => {
      setReplaceVisible(true);
      setFindVisible(false);
    };
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <EditorRuler zoom={zoom} />
      <HeaderFooterModeBar />
      <FindReplacePanel visible={findVisible} onClose={() => setFindVisible(false)} />
      <FindReplacePanel visible={replaceVisible} onClose={() => setReplaceVisible(false)} replaceMode />
      <div
        ref={scrollHostRef}
        onScroll={syncPageFromScroll}
        style={{
          flex: 1,
          overflow: 'auto',
          background: pageEditMode === 'none' ? '#e3e8ee' : '#d7e0ea',
          padding: '0',
          cursor: 'default',
          transition: 'background 0.2s ease',
        }}
      >
        <DocumentEngineHost zoom={zoom} />
      </div>
      {pageEditMode === 'none' ? <MiniToolbar /> : null}
      <EditorContextMenu />
    </div>
  );
}

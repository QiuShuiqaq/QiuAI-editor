import { useState } from 'react';
import { Button } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useEditorStore } from '../../stores/useEditorStore';
import { usePageViewStore } from '../../stores/usePageViewStore';
import { useProjectStore } from '../../stores/useProjectStore';
import {
  DISPLAY_ACTIVE_OBJECT_LABELS,
  DISPLAY_ALIGN_LABELS,
  DISPLAY_REVISION_LABELS,
  DISPLAY_TASK_PANE_LABELS,
  normalizeStyleLabel,
} from '../../utils/displayText';
import { ZoomControl } from '../editor/ZoomControl';
import { WordCountDialog } from '../dialogs/WordCountDialog';
import type { TaskPaneTab } from './TaskPane';

interface StatusBarProps {
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  outlineVisible?: boolean;
  onToggleOutline?: () => void;
  taskPaneOpen?: boolean;
  activeTaskPaneTab?: TaskPaneTab;
  onToggleTaskPane?: () => void;
}

export function StatusBar({
  zoom = 1,
  onZoomChange,
  outlineVisible,
  onToggleOutline,
  taskPaneOpen = false,
  activeTaskPaneTab = 'properties',
  onToggleTaskPane,
}: StatusBarProps) {
  const wordCount = useEditorStore((state) => state.wordCount);
  const pageCount = useEditorStore((state) => state.pageCount);
  const currentPage = useEditorStore((state) => state.currentPage);
  const isDirty = useEditorStore((state) => state.isDirty);
  const formatting = useEditorStore((state) => state.formatting);
  const pageEditMode = usePageViewStore((state) => state.editMode);
  const trackRevisions = useProjectStore((state) => state.doc.documentState.trackRevisions);
  const [wordCountOpen, setWordCountOpen] = useState(false);

  return (
    <>
      <div
        style={{
          height: 30,
          background: '#f3f3f3',
          borderTop: '1px solid #d0d0d0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          fontSize: 12,
          color: '#555',
          gap: 8,
        }}
      >
        <span>{`第 ${currentPage} 页，共 ${pageCount} 页`}</span>
        <span style={{ color: '#d0d0d0' }}>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => setWordCountOpen(true)} title="查看详细字数统计">
          {`${wordCount.toLocaleString()} 字`}
        </span>
        <span style={{ color: '#d0d0d0' }}>|</span>
        <span title="当前样式">{normalizeStyleLabel(formatting.styleLabel)}</span>
        <span style={{ color: '#d0d0d0' }}>|</span>
        <span title="当前对齐">{DISPLAY_ALIGN_LABELS[formatting.textAlign]}</span>
        <span style={{ color: '#d0d0d0' }}>|</span>
        <span title="当前字体与字号">{`${formatting.fontFamily} ${formatting.fontSize}`}</span>
        <span style={{ color: '#d0d0d0' }}>|</span>
        <span title="当前对象">{`对象：${DISPLAY_ACTIVE_OBJECT_LABELS[formatting.activeObject]}`}</span>
        <span style={{ color: '#d0d0d0' }}>|</span>
        <span
          title="修订状态"
          style={{
            color: trackRevisions ? '#cf1322' : '#6b7280',
            fontWeight: trackRevisions ? 600 : 400,
          }}
        >
          {trackRevisions ? '修订：开启' : '修订：关闭'}
        </span>
        {formatting.activeRevisionKind ? (
          <>
            <span style={{ color: '#d0d0d0' }}>|</span>
            <span title="当前修订">{DISPLAY_REVISION_LABELS[formatting.activeRevisionKind]}</span>
          </>
        ) : null}
        {pageEditMode !== 'none' ? (
          <>
            <span style={{ color: '#d0d0d0' }}>|</span>
            <span style={{ color: '#1677ff', fontWeight: 600 }}>
              {pageEditMode === 'header' ? '正在编辑页眉' : '正在编辑页脚'}
            </span>
          </>
        ) : null}
        <span style={{ color: '#d0d0d0' }}>|</span>
        <span title="任务窗格状态">
          {taskPaneOpen ? `任务窗格：${DISPLAY_TASK_PANE_LABELS[activeTaskPaneTab]}` : '任务窗格：已关闭'}
        </span>

        <span style={{ flex: 1 }} />

        <Button
          type="text"
          size="small"
          icon={<FileTextOutlined />}
          onClick={onToggleOutline}
          style={{
            height: 22,
            fontSize: 11,
            color: outlineVisible ? '#1677ff' : '#666',
          }}
        >
          导航
        </Button>

        <Button
          type="text"
          size="small"
          onClick={onToggleTaskPane}
          style={{
            height: 22,
            fontSize: 11,
            color: taskPaneOpen ? '#1677ff' : '#666',
          }}
        >
          任务窗格
        </Button>

        <div style={{ borderLeft: '1px solid #d0d0d0', paddingLeft: 8 }}>
          <ZoomControl zoom={zoom * 100} onChange={(value) => onZoomChange?.(value / 100)} />
        </div>

        <span style={{ color: isDirty ? '#d48806' : '#389e0d', fontSize: 11, minWidth: 64 }}>
          {isDirty ? '尚未保存' : '已保存'}
        </span>
      </div>

      <WordCountDialog open={wordCountOpen} onClose={() => setWordCountOpen(false)} />
    </>
  );
}

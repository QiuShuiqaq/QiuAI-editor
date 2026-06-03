import { useEffect, useState } from 'react';
import { frameworkTreeEquals, syncDocumentWithState } from '@qiuai/shared';
import { Button, Tooltip } from 'antd';
import { MenuUnfoldOutlined } from '@ant-design/icons';
import { RibbonToolbar } from './RibbonToolbar';
import { OutlineSidebar } from './OutlineSidebar';
import { EditorArea } from './EditorArea';
import { StatusBar } from './StatusBar';
import { TaskPane, type TaskPaneTab } from './TaskPane';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import { useProjectStore } from '../../stores/useProjectStore';

const OUTLINE_WIDTH = 220;

export function AppShell() {
  const [zoom, setZoom] = useState(1);
  const [outlineVisible, setOutlineVisible] = useState(true);
  const [readingMode, setReadingMode] = useState(false);
  const [taskPaneOpen, setTaskPaneOpen] = useState(true);
  const [activeTaskPaneTab, setActiveTaskPaneTab] = useState<TaskPaneTab>('assistant');
  const frameworkNodes = useFrameworkStore((state) => state.nodes);
  const setFrameworkNodes = useFrameworkStore((state) => state.setNodes);
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);

  useEffect(() => {
    const documentFramework = doc.framework ?? [];
    if (!frameworkTreeEquals(frameworkNodes, documentFramework)) {
      setDoc(
        syncDocumentWithState({
          ...doc,
          framework: frameworkNodes,
          updatedAt: new Date().toISOString(),
        })
      );
    }
  }, [doc, frameworkNodes, setDoc]);

  useEffect(() => {
    const documentFramework = doc.framework ?? [];
    if (!frameworkTreeEquals(frameworkNodes, documentFramework)) {
      setFrameworkNodes(documentFramework);
    }
  }, [doc.framework, frameworkNodes, setFrameworkNodes]);

  useEffect(() => {
    (window as any).__toggleOutline = () => setOutlineVisible((value: boolean) => !value);
    (window as any).__toggleReadingMode = () => setReadingMode((value: boolean) => !value);
    (window as any).__openTaskPane = (tab: TaskPaneTab = 'assistant') => {
      setActiveTaskPaneTab(tab);
      setTaskPaneOpen(true);
    };
    (window as any).__toggleTaskPane = (tab?: TaskPaneTab) => {
      if (tab) {
        setActiveTaskPaneTab(tab);
        setTaskPaneOpen(true);
        return;
      }
      setTaskPaneOpen((value: boolean) => !value);
    };

    const f11 = (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        event.preventDefault();
        setReadingMode((value) => !value);
      }
    };

    window.addEventListener('keydown', f11);
    return () => {
      delete (window as any).__toggleOutline;
      delete (window as any).__toggleReadingMode;
      delete (window as any).__openTaskPane;
      delete (window as any).__toggleTaskPane;
      window.removeEventListener('keydown', f11);
    };
  }, []);

  return (
    <div
      className={readingMode ? 'reading-mode' : ''}
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: '"Microsoft YaHei","微软雅黑",sans-serif',
      }}
    >
      {!readingMode ? <RibbonToolbar /> : null}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {!readingMode && outlineVisible ? (
          <div
            style={{
              width: OUTLINE_WIDTH,
              minWidth: OUTLINE_WIDTH,
              borderRight: '1px solid #d7deea',
              overflow: 'auto',
              background: 'linear-gradient(180deg, #fbfdff 0%, #f4f7fb 100%)',
            }}
          >
            <OutlineSidebar />
          </div>
        ) : null}

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {!readingMode && !outlineVisible ? (
            <Tooltip title="显示导航窗格">
              <Button
                type="text"
                size="small"
                icon={<MenuUnfoldOutlined />}
                onClick={() => setOutlineVisible(true)}
                style={{
                  position: 'absolute',
                  left: 4,
                  top: 4,
                  zIndex: 10,
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              />
            </Tooltip>
          ) : null}
          <EditorArea zoom={zoom} />
        </div>

        {!readingMode ? (
          <TaskPane
            open={taskPaneOpen}
            activeTab={activeTaskPaneTab}
            onClose={() => setTaskPaneOpen(false)}
            onChangeTab={(tab) => {
              setActiveTaskPaneTab(tab);
              setTaskPaneOpen(true);
            }}
          />
        ) : null}
      </div>

      {!readingMode ? (
        <StatusBar
          zoom={zoom}
          onZoomChange={setZoom}
          outlineVisible={outlineVisible}
          onToggleOutline={() => setOutlineVisible(!outlineVisible)}
          taskPaneOpen={taskPaneOpen}
          activeTaskPaneTab={activeTaskPaneTab}
          onToggleTaskPane={() => setTaskPaneOpen((value) => !value)}
        />
      ) : null}
    </div>
  );
}

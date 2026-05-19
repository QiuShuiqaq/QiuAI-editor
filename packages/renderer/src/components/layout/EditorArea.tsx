import { useState } from 'react';
import { EditorRuler } from '../editor/EditorRuler';
import { EditorContainer } from '../editor/EditorContainer';
import { EditorContextMenu } from '../editor/EditorContextMenu';
import { FindReplacePanel } from '../editor/FindReplacePanel';

interface EditorAreaProps {
  zoom?: number;
}

export function EditorArea({ zoom = 1 }: EditorAreaProps) {
  const [findVisible, setFindVisible] = useState(false);
  const [replaceVisible, setReplaceVisible] = useState(false);

  if (typeof window !== 'undefined') {
    (window as any).__editorShowFind = () => { setFindVisible(true); setReplaceVisible(false); };
    (window as any).__editorShowReplace = () => { setReplaceVisible(true); setFindVisible(false); };
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <EditorRuler />
      <FindReplacePanel visible={findVisible} onClose={() => setFindVisible(false)} />
      <FindReplacePanel visible={replaceVisible} onClose={() => setReplaceVisible(false)} replaceMode />
      <div style={{
        flex: 1, overflow: 'auto', background: '#b8b8b8',
        padding: '12px 0',
        cursor: 'text',
      }}>
        <EditorContainer zoom={zoom} />
      </div>
      {/* Watermark overlay */}
      <div className="editor-watermark" />
      <EditorContextMenu />
    </div>
  );
}

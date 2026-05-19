import { useEffect, useRef } from 'react';
import { useEditorStore } from '../stores/useEditorStore';
import { useProjectStore } from '../stores/useProjectStore';
import { IPC_CHANNELS, type IPCResponse } from '@qiuai/shared';
import { ipcClient } from '../services/ipcClient';

export function useAutoSave(intervalMs = 30000) {
  const isDirty = useEditorStore((s) => s.isDirty);
  const setDirty = useEditorStore((s) => s.setDirty);
  const doc = useProjectStore((s) => s.doc);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(async () => {
      const currentDirty = useEditorStore.getState().isDirty;
      if (!currentDirty) return;

      try {
        const currentDoc = useProjectStore.getState().doc;
        // Include current editor content in the document
        const editor = useEditorStore.getState().editor;
        const docToSave = {
          ...currentDoc,
          editorContent: editor?.getJSON() || currentDoc.editorContent,
          updatedAt: new Date().toISOString(),
        };

        const result = await ipcClient.invoke<IPCResponse>(
          IPC_CHANNELS.FILE_SAVE_DRAFT,
          docToSave
        );

        if (result.success) {
          setDirty(false);
          console.log('[AutoSave] Saved successfully');
        }
      } catch (err) {
        console.error('[AutoSave] Failed:', err);
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [intervalMs, setDirty]);
}

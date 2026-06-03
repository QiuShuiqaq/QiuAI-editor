import { useEffect, useRef } from 'react';
import { useEditorStore } from '../stores/useEditorStore';
import { saveCurrentDocument } from '../services/documentEngineCommands';

export function useAutoSave(intervalMs = 30000) {
  const setDirty = useEditorStore((state) => state.setDirty);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(async () => {
      const currentDirty = useEditorStore.getState().isDirty;
      if (!currentDirty) return;

      try {
        await saveCurrentDocument();
        setDirty(false);
      } catch {
        // Keep autosave silent in the UI thread; manual save remains the visible recovery path.
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [intervalMs, setDirty]);
}

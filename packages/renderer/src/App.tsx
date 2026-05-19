import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { useAutoSave } from './hooks/useAutoSave';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAutoCorrect } from './hooks/useAutoCorrect';

export default function App() {
  useAutoSave(30000);
  useKeyboardShortcuts();
  useAutoCorrect();

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}

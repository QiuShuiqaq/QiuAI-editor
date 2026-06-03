import { EditorContainer } from '../editor/EditorContainer';

interface DocumentEngineHostProps {
  zoom?: number;
}

export function DocumentEngineHost({ zoom = 1 }: DocumentEngineHostProps) {
  return <EditorContainer zoom={zoom} />;
}

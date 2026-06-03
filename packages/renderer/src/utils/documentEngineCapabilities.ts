import type { DocumentEngineAdapter, DocumentEngineCapabilities } from '../types/documentEngine';

export const DEFAULT_DOCUMENT_ENGINE_CAPABILITIES: DocumentEngineCapabilities = {
  selectionRead: false,
  selectionWrite: false,
  commandExecution: false,
  findReplace: false,
  visualSelectionToolbar: false,
  paragraphFormatting: false,
  structuralNavigation: false,
  revisionTracking: false,
  primaryFileSource: false,
};

export function getDocumentEngineCapabilities(
  adapter: DocumentEngineAdapter | null | undefined
): DocumentEngineCapabilities {
  return adapter?.capabilities ?? DEFAULT_DOCUMENT_ENGINE_CAPABILITIES;
}

export function supportsDocumentCommands(adapter: DocumentEngineAdapter | null | undefined): boolean {
  return Boolean(adapter?.executeCommand && getDocumentEngineCapabilities(adapter).commandExecution);
}

export function supportsDocumentFindReplace(adapter: DocumentEngineAdapter | null | undefined): boolean {
  const capabilities = getDocumentEngineCapabilities(adapter);
  return Boolean(adapter?.findInDocument && adapter?.replaceInDocument && capabilities.findReplace);
}

export function supportsVisualSelectionToolbar(adapter: DocumentEngineAdapter | null | undefined): boolean {
  return getDocumentEngineCapabilities(adapter).visualSelectionToolbar;
}

export function supportsStructuralNavigation(adapter: DocumentEngineAdapter | null | undefined): boolean {
  return getDocumentEngineCapabilities(adapter).structuralNavigation;
}

export function supportsRevisionTracking(adapter: DocumentEngineAdapter | null | undefined): boolean {
  return getDocumentEngineCapabilities(adapter).revisionTracking;
}

import type { Editor } from '@tiptap/react';
import type {
  DocumentEngineSelectionSnapshot,
  DocumentEngineWriteResult,
} from '@qiuai/shared';

export type DocumentEngineKind = 'legacy-tiptap' | 'document-core-preview';

export interface DocumentEngineFindRequest {
  query: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  direction?: 'current' | 'next' | 'prev';
}

export interface DocumentEngineFindResult {
  query: string;
  matchCount: number;
  currentIndex: number;
  activePage: number;
  found: boolean;
  selectedText: string;
}

export interface DocumentEngineReplaceRequest extends DocumentEngineFindRequest {
  replaceText: string;
  mode?: 'current' | 'all';
}

export interface DocumentEngineReplaceResult extends DocumentEngineFindResult {
  replacedCount: number;
}

export interface DocumentEngineStatusSnapshot {
  kind: DocumentEngineKind;
  canEdit: boolean;
  pageCount: number;
  wordCount: number;
  selection: DocumentEngineSelectionSnapshot;
}

export interface DocumentEngineCapabilities {
  selectionRead: boolean;
  selectionWrite: boolean;
  commandExecution: boolean;
  findReplace: boolean;
  visualSelectionToolbar: boolean;
  paragraphFormatting: boolean;
  structuralNavigation: boolean;
  revisionTracking: boolean;
  primaryFileSource: boolean;
}

export interface LegacyTipTapEngineAdapter {
  kind: 'legacy-tiptap';
  editor: Editor | null;
  capabilities: DocumentEngineCapabilities;
  getStatus: () => DocumentEngineStatusSnapshot;
  getSelection: () => DocumentEngineSelectionSnapshot;
  replaceSelection: (text: string) => Promise<DocumentEngineWriteResult>;
  executeCommand?: (command: string, payload?: Record<string, unknown>) => Promise<boolean>;
  findInDocument?: (request: DocumentEngineFindRequest) => Promise<DocumentEngineFindResult>;
  replaceInDocument?: (request: DocumentEngineReplaceRequest) => Promise<DocumentEngineReplaceResult>;
  saveDocument: () => Promise<void>;
}

export interface PreviewDocumentEngineAdapter {
  kind: 'document-core-preview';
  capabilities: DocumentEngineCapabilities;
  getStatus: () => DocumentEngineStatusSnapshot;
  getSelection: () => Promise<DocumentEngineSelectionSnapshot>;
  replaceSelection: (text: string) => Promise<DocumentEngineWriteResult>;
  executeCommand: (command: string, payload?: Record<string, unknown>) => Promise<boolean>;
  findInDocument: (request: DocumentEngineFindRequest) => Promise<DocumentEngineFindResult>;
  replaceInDocument: (request: DocumentEngineReplaceRequest) => Promise<DocumentEngineReplaceResult>;
  saveDocument: () => Promise<void>;
}

export type DocumentEngineAdapter =
  | LegacyTipTapEngineAdapter
  | PreviewDocumentEngineAdapter;

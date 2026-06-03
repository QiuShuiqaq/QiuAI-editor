import fs from 'node:fs/promises';
import path from 'node:path';
import {
  countWords,
  createEmptyDocumentState,
  hasMeaningfulEditorContent,
  syncDocumentWithState,
  type DraftMeta,
  type DocumentAuthoringSource,
  type QiuAiDocument,
} from '@qiuai/shared';
import { resolveProjectDataPath } from './projectDataRoot';

const getDraftDir = () => resolveProjectDataPath('drafts');

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function persistAuthoringSource(
  draftDir: string,
  source: DocumentAuthoringSource
): Promise<DocumentAuthoringSource> {
  if (!source.path) {
    return source;
  }

  const normalizedSource = {
    ...createEmptyDocumentState().authoringSource,
    ...source,
  };
  const sourcePath = normalizedSource.path ? path.resolve(normalizedSource.path) : null;

  if (!sourcePath) {
    return normalizedSource;
  }

  if (!(await pathExists(sourcePath))) {
    return normalizedSource;
  }

  const sourceDir = path.join(draftDir, 'authoring-source');
  await fs.mkdir(sourceDir, { recursive: true });

  const extension =
    normalizedSource.kind === 'docx-file'
      ? '.docx'
      : normalizedSource.kind === 'html-file'
        ? '.html'
        : path.extname(sourcePath) || '.bin';
  const targetPath = path.join(sourceDir, `primary${extension}`);

  if (sourcePath !== path.resolve(targetPath)) {
    await fs.copyFile(sourcePath, targetPath);
  }

  return {
    ...normalizedSource,
    path: targetPath,
    updatedAt: normalizedSource.updatedAt ?? new Date().toISOString(),
  };
}

function buildDraftMeta(doc: QiuAiDocument): DraftMeta {
  const normalized = syncDocumentWithState(doc);
  const serializedEditor = JSON.stringify(normalized.editorContent ?? {});
  const hasPrimaryFileSource = normalized.documentState.authoringSource.kind !== 'tiptap-json';
  const hasEditorBody = hasMeaningfulEditorContent(normalized.editorContent);
  const fallbackWordCount = countWords(normalized.title) + normalized.framework.length * 8;

  return {
    id: normalized.id,
    title: normalized.title,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    currentPhase: normalized.currentPhase,
    wordCount: hasPrimaryFileSource
      ? Math.max(countWords(serializedEditor), fallbackWordCount)
      : hasEditorBody
        ? countWords(serializedEditor)
        : fallbackWordCount,
    pageCount: normalized.documentState.pageCount,
  };
}

class DraftService {
  async saveDraft(doc: QiuAiDocument): Promise<DraftMeta> {
    const initialNormalized = syncDocumentWithState({
      ...doc,
      updatedAt: new Date().toISOString(),
    });
    const draftDir = path.join(getDraftDir(), initialNormalized.id);
    const persistedAuthoringSource = await persistAuthoringSource(
      draftDir,
      initialNormalized.documentState.authoringSource
    );
    const normalized = syncDocumentWithState({
      ...initialNormalized,
      documentState: {
        ...initialNormalized.documentState,
        authoringSource: persistedAuthoringSource,
      },
    });

    await fs.mkdir(draftDir, { recursive: true });
    await fs.writeFile(
      path.join(draftDir, 'document.json'),
      JSON.stringify(normalized, null, 2),
      'utf-8'
    );

    const meta = buildDraftMeta(normalized);
    await fs.writeFile(
      path.join(draftDir, 'metadata.json'),
      JSON.stringify(meta, null, 2),
      'utf-8'
    );

    return meta;
  }

  async openDraft(draftId: string): Promise<QiuAiDocument> {
    const filePath = path.join(getDraftDir(), draftId, 'document.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    return syncDocumentWithState(JSON.parse(raw) as QiuAiDocument);
  }

  async listDrafts(): Promise<DraftMeta[]> {
    const dir = getDraftDir();
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const metas: DraftMeta[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        try {
          const metaPath = path.join(dir, entry.name, 'metadata.json');
          const raw = await fs.readFile(metaPath, 'utf-8');
          metas.push(JSON.parse(raw) as DraftMeta);
        } catch {
          // Skip invalid drafts
        }
      }

      return metas.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch {
      return [];
    }
  }

  async deleteDraft(draftId: string): Promise<void> {
    const draftPath = path.join(getDraftDir(), draftId);
    await fs.rm(draftPath, { recursive: true, force: true });
  }
}

export const draftService = new DraftService();

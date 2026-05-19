import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { type DraftMeta, type QiuAiDocument, generateId } from '@qiuai/shared';

const getDraftDir = () => path.join(app.getPath('userData'), 'drafts');

class DraftService {
  async saveDraft(doc: QiuAiDocument): Promise<DraftMeta> {
    const dir = getDraftDir();
    await fs.mkdir(path.join(dir, doc.id), { recursive: true });

    doc.updatedAt = new Date().toISOString();

    await fs.writeFile(
      path.join(dir, doc.id, 'document.json'),
      JSON.stringify(doc, null, 2),
      'utf-8'
    );

    const meta: DraftMeta = {
      id: doc.id,
      title: doc.title,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      currentPhase: doc.currentPhase,
      wordCount: 0,
      pageCount: 0,
    };

    await fs.writeFile(
      path.join(dir, doc.id, 'metadata.json'),
      JSON.stringify(meta, null, 2),
      'utf-8'
    );

    return meta;
  }

  async openDraft(draftId: string): Promise<QiuAiDocument> {
    const filePath = path.join(getDraftDir(), draftId, 'document.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as QiuAiDocument;
  }

  async listDrafts(): Promise<DraftMeta[]> {
    const dir = getDraftDir();
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const metas: DraftMeta[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const metaRaw = await fs.readFile(
              path.join(dir, entry.name, 'metadata.json'),
              'utf-8'
            );
            metas.push(JSON.parse(metaRaw) as DraftMeta);
          } catch {
            // Skip invalid drafts
          }
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

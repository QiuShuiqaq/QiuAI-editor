import type { ReferenceMaterial, TextChunk } from '@qiuai/shared';
import { generateId } from '@qiuai/shared';
import fs from 'node:fs/promises';
import path from 'node:path';

class DOCXService {
  async parseDOCX(filePath: string): Promise<ReferenceMaterial> {
    const fileName = path.basename(filePath);
    const buffer = await fs.readFile(filePath);
    const chunks: TextChunk[] = [];

    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;

      // Split into chunks by paragraph breaks
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
      for (const para of paragraphs) {
        if (para.trim().length > 10) {
          chunks.push({
            id: generateId(),
            text: para.trim(),
            metadata: {},
          });
        }
      }
    } catch {
      chunks.push({
        id: generateId(),
        text: `[DOCX参考文件: ${fileName}]`,
        metadata: {},
      });
    }

    return {
      id: generateId(),
      fileName,
      filePath,
      fileType: 'docx',
      chunks,
    };
  }
}

export const docxService = new DOCXService();

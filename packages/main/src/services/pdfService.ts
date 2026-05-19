import type { ReferenceMaterial, TextChunk } from '@qiuai/shared';
import { generateId } from '@qiuai/shared';
import fs from 'node:fs/promises';
import path from 'node:path';

class PDFService {
  async parsePDF(filePath: string): Promise<ReferenceMaterial> {
    const fileName = path.basename(filePath);
    // Read the file buffer for processing
    // In production, pdf.js would parse this
    const buffer = await fs.readFile(filePath);

    // Placeholder: basic file info returned
    // Full PDF parsing requires pdf.js worker setup in the main process
    const chunks: TextChunk[] = [];

    try {
      // Attempt basic extraction
      const pdfjsLib = await import('pdfjs-dist');
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      });

      const pdf = await loadingTask.promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');

        if (text.trim()) {
          chunks.push({
            id: generateId(),
            text,
            metadata: { page: i },
          });
        }
      }
    } catch {
      // Fallback: store the file path reference
      chunks.push({
        id: generateId(),
        text: `[PDF参考文件: ${fileName}]`,
        metadata: {},
      });
    }

    return {
      id: generateId(),
      fileName,
      filePath,
      fileType: 'pdf',
      chunks,
    };
  }
}

export const pdfService = new PDFService();

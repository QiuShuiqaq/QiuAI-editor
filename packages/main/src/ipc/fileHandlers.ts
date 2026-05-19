import { IpcMain, dialog } from 'electron';
import { IPC_CHANNELS, type IPCResponse, type DraftMeta, type QiuAiDocument } from '@qiuai/shared';
import { draftService } from '../services/draftService';
import { pdfService } from '../services/pdfService';
import { docxService } from '../services/docxService';

export function registerFileHandlers(ipcMain: IpcMain) {
  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_DRAFT, async (_event, doc: QiuAiDocument): Promise<IPCResponse<DraftMeta>> => {
    try {
      const meta = await draftService.saveDraft(doc);
      return { success: true, data: meta };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_OPEN_DRAFT, async (_event, draftId: string): Promise<IPCResponse<QiuAiDocument>> => {
    try {
      const doc = await draftService.openDraft(draftId);
      return { success: true, data: doc };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_LIST_DRAFTS, async (): Promise<IPCResponse<DraftMeta[]>> => {
    try {
      const drafts = await draftService.listDrafts();
      return { success: true, data: drafts };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DELETE_DRAFT, async (_event, draftId: string): Promise<IPCResponse<void>> => {
    try {
      await draftService.deleteDraft(draftId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_IMPORT_REFERENCE, async (_event, fileType: string): Promise<IPCResponse> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: fileType === 'pdf'
          ? [{ name: 'PDF文件', extensions: ['pdf'] }]
          : [{ name: 'Word文档', extensions: ['docx', 'doc'] }],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      const filePath = result.filePaths[0];
      if (fileType === 'pdf') {
        const parsed = await pdfService.parsePDF(filePath);
        return { success: true, data: parsed };
      } else {
        const parsed = await docxService.parseDOCX(filePath);
        return { success: true, data: parsed };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

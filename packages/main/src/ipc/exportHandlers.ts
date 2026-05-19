import { IpcMain, dialog } from 'electron';
import { IPC_CHANNELS, type IPCResponse, type QiuAiDocument } from '@qiuai/shared';
import { exportService } from '../services/exportService';

export function registerExportHandlers(ipcMain: IpcMain) {
  ipcMain.handle(IPC_CHANNELS.EXPORT_DOCX, async (_event, doc: QiuAiDocument): Promise<IPCResponse<string>> => {
    try {
      const result = await dialog.showSaveDialog({
        defaultPath: `${doc.title || '申报书'}.docx`,
        filters: [{ name: 'Word文档', extensions: ['docx'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: true, data: undefined };
      }

      await exportService.exportDOCX(doc, result.filePath);
      return { success: true, data: result.filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_PDF, async (_event, doc: QiuAiDocument): Promise<IPCResponse<string>> => {
    try {
      const result = await dialog.showSaveDialog({
        defaultPath: `${doc.title || '申报书'}.pdf`,
        filters: [{ name: 'PDF文件', extensions: ['pdf'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: true, data: undefined };
      }

      await exportService.exportPDF(doc, result.filePath);
      return { success: true, data: result.filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

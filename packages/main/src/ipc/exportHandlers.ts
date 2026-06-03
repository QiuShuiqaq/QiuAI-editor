import { IpcMain, dialog } from 'electron';
import { IPC_CHANNELS, type ExportRequest, type IPCResponse } from '@qiuai/shared';
import { exportService } from '../services/exportService';

export function registerExportHandlers(ipcMain: IpcMain) {
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_DOCX,
    async (_event, payload: ExportRequest): Promise<IPCResponse<string>> => {
      try {
        const result = await dialog.showSaveDialog({
          defaultPath: payload.suggestedFileName || `${payload.doc.title || '项目报告'}.docx`,
          filters: [{ name: 'Word 文档', extensions: ['docx'] }],
        });

        if (result.canceled || !result.filePath) {
          return { success: true, data: undefined };
        }

        await exportService.exportDOCX(payload.doc, result.filePath, {
          authoringHtml: payload.authoringHtml,
        });
        return { success: true, data: result.filePath };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'DOCX 导出失败';
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_PDF,
    async (_event, payload: ExportRequest): Promise<IPCResponse<string>> => {
      try {
        const result = await dialog.showSaveDialog({
          defaultPath: payload.suggestedFileName || `${payload.doc.title || '项目报告'}.pdf`,
          filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
        });

        if (result.canceled || !result.filePath) {
          return { success: true, data: undefined };
        }

        await exportService.exportPDF(payload.doc, result.filePath, {
          authoringHtml: payload.authoringHtml,
        });
        return { success: true, data: result.filePath };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'PDF 导出失败';
        return { success: false, error: message };
      }
    }
  );
}

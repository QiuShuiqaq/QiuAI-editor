import { IpcMain } from 'electron';
import { IPC_CHANNELS, type IPCResponse, type TextGenRequest, type PolishRequest, type ImageGenRequest, type TableProcessRequest } from '@qiuai/shared';
import { textGenerationService } from '../ai/textGenerationService';
import { polishService } from '../ai/polishService';
import { imageGenService } from '../ai/imageGenService';
import { tableAgentService } from '../ai/tableAgentService';

export function registerAIHandlers(ipcMain: IpcMain) {
  ipcMain.handle(IPC_CHANNELS.AI_GENERATE_TEXT, async (_event, request: TextGenRequest): Promise<IPCResponse> => {
    try {
      const result = await textGenerationService.generateSection(request);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_POLISH_TEXT, async (_event, request: PolishRequest): Promise<IPCResponse> => {
    try {
      const result = await polishService.polish(request);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_GENERATE_IMAGE, async (_event, request: ImageGenRequest): Promise<IPCResponse> => {
    try {
      const result = await imageGenService.generate(request);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_PROCESS_TABLE, async (_event, request: TableProcessRequest): Promise<IPCResponse> => {
    try {
      const result = await tableAgentService.process(request);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

import { IpcMain } from 'electron';
import {
  IPC_CHANNELS,
  type IPCResponse,
  type TextGenChunk,
  type TextGenRequest,
  type PolishRequest,
  type ImageGenRequest,
  type TableProcessRequest,
  type AIChatRequest,
} from '@qiuai/shared';
import { authoringOrchestrator } from '../ai/authoringOrchestrator';
import { chatService } from '../ai/chatService';
import { imageGenService } from '../ai/imageGenService';
import { tableAgentService } from '../ai/tableAgentService';

export function registerAIHandlers(ipcMain: IpcMain) {
  ipcMain.handle(IPC_CHANNELS.AI_GENERATE_TEXT, async (_event, request: TextGenRequest): Promise<IPCResponse> => {
    try {
      const result = await authoringOrchestrator.generateSection(request);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_CHAT, async (_event, request: AIChatRequest): Promise<IPCResponse> => {
    try {
      const result = await chatService.chat(request);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_POLISH_TEXT, async (_event, request: PolishRequest): Promise<IPCResponse> => {
    try {
      const result = await authoringOrchestrator.polishText(request);
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

  ipcMain.on(IPC_CHANNELS.AI_GENERATE_TEXT_STREAM, async (event, payload: { requestId: string; request: TextGenRequest }) => {
    const { requestId, request } = payload;
    const replyChannel = `${IPC_CHANNELS.AI_GENERATE_TEXT_STREAM}:${requestId}`;

    try {
      const result = await authoringOrchestrator.generateSection(request, (chunk) => {
        const streamChunk: TextGenChunk = {
          requestId,
          content: chunk,
          done: false,
        };
        event.sender.send(replyChannel, streamChunk);
      });

      const doneChunk: TextGenChunk = {
        requestId,
        content: '',
        done: true,
        provider: result.provider,
        model: result.model,
        paperSpineEnhancement: result.paperSpineEnhancement,
        paperSpineSource: result.paperSpineSource,
      };
      event.sender.send(replyChannel, doneChunk);
    } catch (err: any) {
      const errorChunk: TextGenChunk = {
        requestId,
        content: '',
        done: true,
        error: err?.message || String(err),
      };
      event.sender.send(replyChannel, errorChunk);
    }
  });
}

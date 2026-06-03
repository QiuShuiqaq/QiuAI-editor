import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { loadLocalEnv } from './config/loadLocalEnv';
import { registerFileHandlers } from './ipc/fileHandlers';
import { registerAIHandlers } from './ipc/aiHandlers';
import { registerExportHandlers } from './ipc/exportHandlers';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'QiuAI Editor - 项目报告编辑器',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/dist/index.html'));
  }
}

function registerIPC() {
  registerFileHandlers(ipcMain);
  registerAIHandlers(ipcMain);
  registerExportHandlers(ipcMain);
}

app.whenReady().then(() => {
  loadLocalEnv();
  registerIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

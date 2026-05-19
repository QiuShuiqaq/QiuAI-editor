import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
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
    title: '秋AI编辑器 - 科研项目申报书AI辅助写作',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
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

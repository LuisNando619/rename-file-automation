const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

let server;
let outputDirectory;

app.setPath('userData', path.join(app.getPath('appData'), 'Rename File'));

async function createWindow(port) {
  const window = new BrowserWindow({
    width: 1180,
    height: 850,
    minWidth: 760,
    minHeight: 640,
    backgroundColor: '#f3f5f1',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const localUrl = `http://127.0.0.1:${port}`;
  const localOrigin = new URL(localUrl).origin;

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== localOrigin) {
      event.preventDefault();
    }
  });

  await window.loadURL(localUrl);
}

async function startDesktopApp() {
  outputDirectory = path.join(app.getPath('documents'), 'Rename File');
  process.env.DOCUMENT_STORAGE_DIR = outputDirectory;
  fs.mkdirSync(outputDirectory, { recursive: true });

  ipcMain.handle('open-output-folder', async () => {
    const processedDirectory = path.join(outputDirectory, 'processed');
    fs.mkdirSync(processedDirectory, { recursive: true });
    const error = await shell.openPath(processedDirectory);
    if (error) {
      throw new Error(`Não foi possível abrir a pasta: ${error}`);
    }
  });

  const serverApp = require('../src/app');
  server = serverApp.listen(0, '127.0.0.1');
  server.once('error', async (error) => {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Erro ao iniciar',
      message: 'Não foi possível iniciar o processamento local.',
      detail: error.message,
    });
    app.quit();
  });
  server.once('listening', () => {
    createWindow(server.address().port).catch(async (error) => {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Erro ao abrir',
        message: 'Não foi possível abrir a janela do Rename File.',
        detail: error.message,
      });
      app.quit();
    });
  });
}

app.whenReady().then(startDesktopApp).catch(async (error) => {
  await dialog.showMessageBox({
    type: 'error',
    title: 'Erro ao iniciar',
    message: 'Não foi possível iniciar o Rename File.',
    detail: error.message,
  });
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (server) server.close();
});

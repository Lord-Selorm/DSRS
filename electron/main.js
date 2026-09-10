const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let expressServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'DSRS - Disused Sealed Radioactive Sources',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Boot the Express API in-process against the local SQLite store.
function startApi() {
  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

  process.env.DB_ENGINE = 'sqlite';
  process.env.DB_FILE = path.join(app.getPath('userData'), 'dsrs.sqlite');
  if (isDev) process.env.PORT = process.env.PORT || '5000';

  const serverApp = require('../server/index');
  const port = isDev ? Number(process.env.PORT) : 0;

  expressServer = serverApp.listen(port, '127.0.0.1', () => {
    if (!mainWindow) createWindow();
    const addr = expressServer.address().port;
    const url = isDev ? process.env.VITE_DEV_SERVER_URL : `http://127.0.0.1:${addr}`;
    mainWindow.loadURL(url);
    require('../server/index').syncController.start();
  });

  // Expose sync state to the renderer (also reachable via /api/sync/status).
  ipcMain.handle('sync:status', () => {
    const controller = require('../server/index').syncController;
    return controller ? controller.status() : { enabled: false };
  });
  ipcMain.handle('sync:run', async () => {
    const controller = require('../server/index').syncController;
    return controller ? controller.runSync() : { enabled: false };
  });
}

app.whenReady().then(() => {
  startApi();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (expressServer) expressServer.close();
});
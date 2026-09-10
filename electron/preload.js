const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dsrs', {
  platform: process.platform,
  isElectron: true,
  sync: {
    status: () => ipcRenderer.invoke('sync:status'),
    run: () => ipcRenderer.invoke('sync:run'),
  },
});
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('dsrs', {
  platform: process.platform,
  isElectron: true,
});
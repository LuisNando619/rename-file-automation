const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('renameFileDesktop', {
  openOutputFolder: () => ipcRenderer.invoke('open-output-folder'),
});

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    selectFile: () => ipcRenderer.invoke('select-file'),
    processPdf: (filePath) => ipcRenderer.invoke('process-pdf', filePath),
    getPathForFile: (file) => webUtils.getPathForFile(file),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onFullscreenChange: (callback) => ipcRenderer.on('fullscreen-change', (_event, isFullscreen) => callback(isFullscreen)),
  createNewWindow: () => ipcRenderer.send('new-window'),
  
  // Ad blocker
  onAdBlockedBatch: (callback) => ipcRenderer.on('ad-blocked-batch', (_event, data) => callback(data)),
  setShieldEnabled: (enabled) => ipcRenderer.send('set-shield-enabled', enabled),
  
  // Downloads IPC channels
  onDownloadStarted: (callback) => ipcRenderer.on('download-started', (_event, data) => callback(data)),
  onDownloadUpdated: (callback) => ipcRenderer.on('download-updated', (_event, data) => callback(data)),
  onDownloadDone: (callback) => ipcRenderer.on('download-done', (_event, data) => callback(data)),
  cancelDownload: (id) => ipcRenderer.send('cancel-download', id),
  showItemInFolder: (path) => ipcRenderer.send('show-item-in-folder', path)
});

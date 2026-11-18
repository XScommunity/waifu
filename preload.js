const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getHistory: () => ipcRenderer.invoke('get-history'),
  saveHistory: (history) => ipcRenderer.invoke('save-history', history),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  generateEdgeTts: (params) => ipcRenderer.invoke('generate-edge-tts', params),
  callChatApi: (params) => ipcRenderer.invoke('call-chat-api', params),
  windowDragStart: () => ipcRenderer.send('window-drag-start'),
  windowDragMove: () => ipcRenderer.send('window-drag-move'),
  windowDragEnd: () => ipcRenderer.send('window-drag-end'),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowClose: () => ipcRenderer.send('window-close'),
  toggleAlwaysOnTop: (flag) => ipcRenderer.invoke('toggle-always-on-top', flag),
  getCursorPos: () => ipcRenderer.invoke('get-cursor-pos'),
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  saveTasks: (tasks) => ipcRenderer.invoke('save-tasks', tasks),
  checkDistractions: () => ipcRenderer.invoke('check-distractions'),
  onProcrastinationAlert: (callback) => ipcRenderer.on('procrastination-alert', (event, data) => callback(data))
});

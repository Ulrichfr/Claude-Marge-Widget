'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settings', {
  load: () => ipcRenderer.invoke('settings:load'),
  save: (config) => ipcRenderer.invoke('settings:save', config),
  reset: () => ipcRenderer.invoke('settings:reset'),
  reveal: () => ipcRenderer.send('settings:reveal'),
  displays: () => ipcRenderer.invoke('settings:displays'),
  checkUpdate: () => ipcRenderer.invoke('updates:check'),
  applyUpdate: () => ipcRenderer.invoke('updates:apply'),
  onUpdateStep: (fn) => ipcRenderer.on('updates:step', (_e, step) => fn(step))
});

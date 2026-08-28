'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widget', {
  onGeometry: (fn) => ipcRenderer.on('geometry', (_e, g) => fn(g)),
  onUsage: (fn) => ipcRenderer.on('usage', (_e, d) => fn(d)),
  onReveal: (fn) => ipcRenderer.on('reveal', (_e, v) => fn(v)),
  onCursor: (fn) => ipcRenderer.on('cursor', (_e, p) => fn(p)),
  requestRefresh: () => ipcRenderer.send('request-refresh')
});

// Most między stroną a oknem Electron: pełny ekran okna (zamiast pełnego ekranu HTML)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('moorme', {
  setFullscreen: (on) => ipcRenderer.invoke('fullscreen:set', !!on),
  isFullscreen: () => ipcRenderer.invoke('fullscreen:get')
});

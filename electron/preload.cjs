const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dentiaDesktop', {
  retry: () => ipcRenderer.send('dentia:retry'),
})

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("arbacs", {
  checkUpdates: () => ipcRenderer.invoke("launcher:check-updates"),
  applyUpdates: () => ipcRenderer.invoke("launcher:apply-updates"),
  play: () => ipcRenderer.invoke("launcher:play"),
  openMods: () => ipcRenderer.invoke("launcher:open-mods"),
  getConfig: () => ipcRenderer.invoke("launcher:get-config"),
  saveConfig: (config) => ipcRenderer.invoke("launcher:save-config", config),
  chooseMinecraftDir: () => ipcRenderer.invoke("launcher:choose-minecraft-dir")
});

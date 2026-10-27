import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  listProducteurs: () => ipcRenderer.invoke("producteurs:list"),
  updateProducteur: (p: unknown) => ipcRenderer.invoke("producteurs:update", p),
  getParametres: () => ipcRenderer.invoke("parametres:get"),
  saveParametres: (url: string, jeton: string) => ipcRenderer.invoke("parametres:save", url, jeton),
});

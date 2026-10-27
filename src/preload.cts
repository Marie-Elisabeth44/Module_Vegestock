import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  listProducteurs: () => ipcRenderer.invoke("producteurs:list"),
  updateProducteur: (p: unknown) => ipcRenderer.invoke("producteurs:update", p),
  nextIdProducteur: () => ipcRenderer.invoke("producteurs:nextId"),
  addProducteur: (p: unknown) => ipcRenderer.invoke("producteurs:add", p),
  parcourirCsv: () => ipcRenderer.invoke("dialog:parcourirCsv"),
  getParametres: () => ipcRenderer.invoke("parametres:get"),
  saveParametres: (url: string, jeton: string, csv?: unknown) => ipcRenderer.invoke("parametres:save", url, jeton, csv),
});

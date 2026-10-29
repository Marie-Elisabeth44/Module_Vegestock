import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  listProducteurs: () => ipcRenderer.invoke("producteurs:list"),
  updateProducteur: (p: unknown) => ipcRenderer.invoke("producteurs:update", p),
  nextIdProducteur: () => ipcRenderer.invoke("producteurs:nextId"),
  addProducteur: (p: unknown) => ipcRenderer.invoke("producteurs:add", p),
  listCorrespondances: (nom: string) => ipcRenderer.invoke("correspondances:list", nom),
  saveCorrespondances: (nom: string, lignes: unknown) => ipcRenderer.invoke("correspondances:save", nom, lignes),
  parcourirCsv: () => ipcRenderer.invoke("dialog:parcourirCsv"),
  choisirLogo: () => ipcRenderer.invoke("logo:choisir"),
  envoyerLogo: () => ipcRenderer.invoke("logo:envoyer"),
  getParametres: () => ipcRenderer.invoke("parametres:get"),
  saveParametres: (url: string, jeton: string, csv?: unknown) => ipcRenderer.invoke("parametres:save", url, jeton, csv),
});

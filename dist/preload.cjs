"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("api", {
    listProducteurs: () => electron_1.ipcRenderer.invoke("producteurs:list"),
    updateProducteur: (p) => electron_1.ipcRenderer.invoke("producteurs:update", p),
    getParametres: () => electron_1.ipcRenderer.invoke("parametres:get"),
    saveParametres: (url, jeton) => electron_1.ipcRenderer.invoke("parametres:save", url, jeton),
});

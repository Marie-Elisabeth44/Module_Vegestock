import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import { getProducteurs, updateProducteur, type Producteur } from "./producteurs.js";
import { getParametresPublics, saveParametres } from "./parametres.js";

app.whenReady().then(() => {
  ipcMain.handle("producteurs:list", getProducteurs);
  ipcMain.handle("producteurs:update", (_e, p: Producteur) => updateProducteur(p));
  ipcMain.handle("parametres:get", getParametresPublics);
  ipcMain.handle("parametres:save", (_e, url: string, jeton: string) => saveParametres(String(url), String(jeton)));
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: fileURLToPath(new URL("./preload.cjs", import.meta.url)),
    },
  });
  win.loadFile(fileURLToPath(new URL("../src/renderer/index.html", import.meta.url)));
});

app.on("window-all-closed", () => app.quit());

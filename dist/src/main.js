import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import { getProducteurs } from "./producteurs.js";
app.whenReady().then(() => {
    ipcMain.handle("producteurs:list", getProducteurs);
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

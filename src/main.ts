import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { fileURLToPath } from "node:url";
import { ajouterProducteurSite, getIdDisponible, getProducteurs, updateProducteur, type Producteur } from "./producteurs.js";
import { ajouterProducteur } from "./producteurCsv.js";
import { enregistrerCorrespondances, lireCorrespondances, NOMS, type Correspondance, type Nom } from "./correspondances.js";
import { getParametresPublics, saveParametres, type CsvParametres } from "./parametres.js";

// Le CSV est écrit avant le site : on valide donc ici ce que le site refuserait, pour ne rien écrire inutilement
async function ajouterProducteurComplet(p: Producteur) {
  if (!Number.isInteger(p?.id)) throw new Error("Identifiant invalide");
  if (!String(p.entreprise ?? "").trim()) throw new Error("Le nom de l'entreprise est obligatoire");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email ?? ""))) throw new Error("Email invalide");
  await ajouterProducteur({ id: p.id, entreprise: p.entreprise, email: p.email });
  return ajouterProducteurSite(p);
}

// Arguments IPC non fiables : on reconstruit la config champ par champ
function csvDepuisIpc(c: any): CsvParametres | undefined {
  if (!c) return undefined;
  return {
    mode: String(c.mode) as CsvParametres["mode"],
    chemin: String(c.chemin ?? ""),
    ftp: {
      hote: String(c.ftp?.hote ?? ""),
      port: Number(c.ftp?.port),
      utilisateur: String(c.ftp?.utilisateur ?? ""),
      mdp: String(c.ftp?.mdp ?? ""),
      cheminDistant: String(c.ftp?.cheminDistant ?? ""),
    },
  };
}

function nomCorrespondance(nom: unknown): Nom {
  if (!NOMS.includes(nom as Nom)) throw new Error("Correspondance inconnue");
  return nom as Nom;
}

function lignesDepuisIpc(lignes: unknown): Correspondance[] {
  if (!Array.isArray(lignes)) throw new Error("Lignes invalides");
  return lignes.map((l) => ({ code: String(l?.code ?? ""), libelle: String(l?.libelle ?? "") }));
}

app.whenReady().then(() => {
  ipcMain.handle("producteurs:list", getProducteurs);
  ipcMain.handle("producteurs:update", (_e, p: Producteur) => updateProducteur(p));
  ipcMain.handle("producteurs:nextId", getIdDisponible);
  ipcMain.handle("producteurs:add", (_e, p: Producteur) => ajouterProducteurComplet(p));
  ipcMain.handle("correspondances:list", (_e, nom: string) => lireCorrespondances(nomCorrespondance(nom)));
  ipcMain.handle("correspondances:save", (_e, nom: string, lignes: unknown) =>
    enregistrerCorrespondances(nomCorrespondance(nom), lignesDepuisIpc(lignes)));
  ipcMain.handle("dialog:parcourirCsv", async (e) => {
    const options = { filters: [{ name: "Fichier CSV", extensions: ["csv"] }], properties: ["openFile" as const] };
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return r.canceled ? null : r.filePaths[0] ?? null;
  });
  ipcMain.handle("parametres:get", getParametresPublics);
  ipcMain.handle("parametres:save", (_e, url: string, jeton: string, csv?: unknown) =>
    saveParametres(String(url), String(jeton), csvDepuisIpc(csv)));
  Menu.setApplicationMenu(null);
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

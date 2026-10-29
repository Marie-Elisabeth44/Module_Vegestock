import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

const URL_DEFAUT = "http://local.vegestock/api/producteurs.php";
const fichier = () => path.join(app.getPath("userData"), "parametres.json");

export type ModeCsv = "chemin" | "ftp" | "";
export interface CsvFtp { hote: string; port: number; utilisateur: string; mdp: string; cheminDistant: string }
export interface CsvParametres { mode: ModeCsv; chemin: string; ftp: CsvFtp }

// jeton et csv.ftp.mdp : base64 du chiffrement DPAPI
interface Stocke { url: string; jeton: string; csv: CsvParametres }

const CSV_DEFAUT: CsvParametres = {
  mode: "", chemin: "",
  ftp: { hote: "", port: 21, utilisateur: "", mdp: "", cheminDistant: "" },
};

function lire(): Stocke {
  let brut: Partial<Stocke> = {};
  try { brut = JSON.parse(fs.readFileSync(fichier(), "utf8")); } catch { /* absent ou illisible : valeurs par défaut */ }
  return {
    url: brut.url ?? URL_DEFAUT,
    jeton: brut.jeton ?? "",
    csv: { ...CSV_DEFAUT, ...brut.csv, ftp: { ...CSV_DEFAUT.ftp, ...brut.csv?.ftp } },
  };
}

const dechiffrer = (b64: string) => (b64 ? safeStorage.decryptString(Buffer.from(b64, "base64")) : "");

// Utilisé côté main uniquement : le jeton ne part jamais vers le renderer.
export function getParametres(): { url: string; jeton: string } {
  const s = lire();
  return { url: s.url, jeton: dechiffrer(s.jeton) };
}

// Utilisé côté main uniquement : mot de passe FTP déchiffré.
export function getParametresCsv(): CsvParametres {
  const { csv } = lire();
  return { ...csv, ftp: { ...csv.ftp, mdp: dechiffrer(csv.ftp.mdp) } };
}

// Fichier `nom` (ex. conditionnements.csv) du sous-dossier liaisons/, à côté de producteurs.csv : même mode d'accès, chemin déduit.
export function getParametresLiaison(nom: string): CsvParametres {
  const csv = getParametresCsv();
  if (csv.mode === "chemin") return { ...csv, chemin: path.join(path.dirname(csv.chemin), "liaisons", nom) };
  if (csv.mode === "ftp") {
    return { ...csv, ftp: { ...csv.ftp, cheminDistant: path.posix.join(path.posix.dirname(csv.ftp.cheminDistant), "liaisons", nom) } };
  }
  throw new Error("Emplacement de producteurs.csv non paramétré");
}

export function getParametresPublics(): {
  url: string;
  jetonDefini: boolean;
  csv: Omit<CsvParametres, "ftp"> & { ftp: Omit<CsvFtp, "mdp"> & { mdpDefini: boolean } };
} {
  const s = lire();
  const { mdp, ...ftp } = s.csv.ftp;
  return { url: s.url, jetonDefini: !!s.jeton, csv: { ...s.csv, ftp: { ...ftp, mdpDefini: !!mdp } } };
}

// jeton vide = on conserve l'actuel ; csv absent = on conserve l'actuel ; csv.ftp.mdp vide = on conserve l'actuel
export function saveParametres(url: string, jeton: string, csv?: CsvParametres): void {
  if (!/^https?:\/\//i.test(url)) throw new Error("URL invalide : elle doit commencer par http:// ou https://");
  if ((jeton || csv?.ftp.mdp) && !safeStorage.isEncryptionAvailable()) throw new Error("Chiffrement indisponible sur ce poste");
  const actuel = lire();
  let nouveauCsv = actuel.csv;
  if (csv) {
    if (!["chemin", "ftp", ""].includes(csv.mode)) throw new Error("Mode de producteurs.csv invalide");
    if (csv.mode === "chemin" && !csv.chemin.trim()) throw new Error("Chemin de producteurs.csv obligatoire");
    if (csv.mode === "ftp") {
      const f = csv.ftp;
      if (!f.hote.trim()) throw new Error("Hôte FTP obligatoire");
      if (!Number.isInteger(f.port) || f.port < 1 || f.port > 65535) throw new Error("Port FTP invalide");
      if (!f.cheminDistant.trim()) throw new Error("Chemin distant FTP obligatoire");
    }
    const mdp = csv.ftp.mdp ? safeStorage.encryptString(csv.ftp.mdp).toString("base64") : actuel.csv.ftp.mdp;
    nouveauCsv = { ...csv, ftp: { ...csv.ftp, mdp } };
  }
  const stocke: Stocke = {
    url,
    jeton: jeton ? safeStorage.encryptString(jeton).toString("base64") : actuel.jeton,
    csv: nouveauCsv,
  };
  fs.writeFileSync(fichier(), JSON.stringify(stocke));
}

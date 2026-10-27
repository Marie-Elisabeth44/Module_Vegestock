import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "basic-ftp";

export interface LigneProducteur { id: number; entreprise: string; email: string }

const SEP = ";";

// Découpe un texte CSV en enregistrements, guillemets et retours ligne dans les valeurs compris
// `bornes` reçoit, si fourni, le [début, fin[ de chaque enregistrement dans le texte (retour ligne final inclus)
export function parserCsv(texte: string, bornes?: [number, number][]): string[][] {
  const lignes: string[][] = [];
  let debut = 0;
  let champ = "";
  let ligne: string[] = [];
  let guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c !== '"') champ += c;
      else if (texte[i + 1] === '"') { champ += '"'; i++; }
      else guillemets = false;
    } else if (c === '"') guillemets = true;
    else if (c === SEP) { ligne.push(champ); champ = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ); lignes.push(ligne); champ = ""; ligne = [];
      bornes?.push([debut, i + 1]); debut = i + 1;
    } else champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); bornes?.push([debut, texte.length]); }
  return lignes;
}

export const echapper = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

// Contenu du fichier avec la ligne ajoutée (valeurs placées d'après les en-têtes), encodage et fin de ligne conservés.
// Retourne null si la ligne y figure déjà (reprise) ; erreur si l'id est pris par un autre producteur.
// Si l'id existe avec l'entreprise « Non défini », la ligne est remplacée sur place.
export function ajouterLigne(octets: Buffer, p: LigneProducteur): Buffer | null {
  const bom = octets.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
  let texte: string;
  try {
    texte = new TextDecoder("utf-8", { fatal: true }).decode(octets.subarray(bom ? 3 : 0));
  } catch {
    throw new Error("producteur.csv : encodage UTF-8 attendu");
  }
  const bornes: [number, number][] = [];
  const lignes = parserCsv(texte, bornes);
  if (!lignes.length) throw new Error("producteur.csv : en-têtes manquants");
  const entetes = lignes[0].map((h) => h.trim().toLowerCase());
  const col = (nom: string) => {
    const i = entetes.indexOf(nom);
    if (i < 0) throw new Error(`producteur.csv : colonne « ${nom} » introuvable`);
    return i;
  };
  const [iId, iEntreprise, iEmail] = [col("id"), col("entreprise"), col("email")];

  const idx = lignes.findIndex((l, i) => i > 0 && l[iId]?.trim() === String(p.id));
  const existante = lignes[idx];
  if (existante) {
    if (existante[iEntreprise] === p.entreprise && existante[iEmail] === p.email) return null;
    if (existante[iEntreprise]?.trim().toLowerCase() !== "non défini") throw new Error("Id déjà utilisé");
    const [debut, fin] = bornes[idx];
    const valeurs = entetes.map((_, i) => existante[i] ?? "");
    valeurs[iEntreprise] = p.entreprise;
    valeurs[iEmail] = p.email;
    const fdl = /(\r\n|\r|\n)$/.exec(texte.slice(debut, fin))?.[0] ?? "";
    const remplace = texte.slice(0, debut) + valeurs.map(echapper).join(SEP) + fdl + texte.slice(fin);
    return Buffer.from((bom ? "﻿" : "") + remplace, "utf8");
  }

  const eol = /\r\n/.test(texte) ? "\r\n" : /\n/.test(texte) ? "\n" : /\r/.test(texte) ? "\r" : "\r\n";
  const valeurs = entetes.map(() => "");
  valeurs[iId] = String(p.id);
  valeurs[iEntreprise] = p.entreprise;
  valeurs[iEmail] = p.email;
  const fin = /[\r\n]$/.test(texte) ? "" : eol;
  const ajout = fin + valeurs.map(echapper).join(SEP) + eol;
  return Buffer.concat([octets, Buffer.from(ajout, "utf8")]);
}

async function surFichierLocal(chemin: string, p: LigneProducteur): Promise<void> {
  const nouveau = ajouterLigne(fs.readFileSync(chemin), p);
  if (!nouveau) return;
  const tmp = `${chemin}.tmp`;
  try {
    fs.writeFileSync(tmp, nouveau);
    fs.renameSync(tmp, chemin);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

async function surFtp(
  ftp: { hote: string; port: number; utilisateur: string; mdp: string; cheminDistant: string },
  p: LigneProducteur,
): Promise<void> {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "vegestock-"));
  const local = path.join(dossier, "producteur.csv");
  const client = new Client(15000);
  try {
    await client.access({ host: ftp.hote, port: ftp.port, user: ftp.utilisateur, password: ftp.mdp, secure: false });
    await client.downloadTo(local, ftp.cheminDistant);
    const nouveau = ajouterLigne(fs.readFileSync(local), p);
    if (!nouveau) return;
    fs.writeFileSync(local, nouveau);
    // Envoi sous un nom temporaire, contrôle de la taille, puis remplacement : le fichier distant n'est touché qu'en dernier
    const distantTmp = `${ftp.cheminDistant}.tmp`;
    try {
      await client.uploadFrom(local, distantTmp);
      if ((await client.size(distantTmp)) !== nouveau.length) throw new Error("taille distante différente de celle envoyée");
      await client.rename(distantTmp, ftp.cheminDistant);
    } catch (e) {
      await client.remove(distantTmp, true).catch(() => {});
      throw new Error(`Échec du renvoi FTP, fichier distant non modifié : ${e instanceof Error ? e.message : e}`);
    }
  } finally {
    client.close();
    fs.rmSync(dossier, { recursive: true, force: true });
  }
}

// Ajoute le producteur en fin de producteur.csv (chemin local ou FTP selon les paramètres)
export async function ajouterProducteur(p: LigneProducteur): Promise<void> {
  // Imports différés : parametres.ts et producteurs.ts dépendent d'Electron, ce qui empêche de tester les fonctions pures sous node seul
  const { getParametresCsv } = await import("./parametres.js");
  const { encoder } = await import("./producteurs.js");
  if (!Number.isInteger(p.id)) throw new Error("Identifiant invalide");
  const ligne = { id: p.id, entreprise: encoder(String(p.entreprise)), email: String(p.email) };
  const csv = getParametresCsv();
  if (csv.mode === "chemin") return surFichierLocal(csv.chemin, ligne);
  if (csv.mode === "ftp") return surFtp(csv.ftp, ligne);
  throw new Error("Emplacement de producteur.csv non paramétré");
}

import fs from "node:fs";
import path from "node:path";
import { avecAcces, cheminFichier } from "./producteurCsv.js";

export const TAILLE_MAX = 200 * 1024;
export const EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];

// Le renderer ne fournit jamais de chemin : le fichier choisi reste ici, côté main, jusqu'à l'envoi
let enAttente: { source: string; nom: string } | null = null;

// Nom sûr pour une URL et un chemin FTP : sans dossier, caractères hors [A-Za-z0-9._-] remplacés
export function nomLogo(source: string): string {
  const nom = path.basename(source).replace(/[^A-Za-z0-9._-]/g, "_");
  if (!EXTENSIONS.includes(path.extname(nom).slice(1).toLowerCase())) throw new Error(`Image attendue (${EXTENSIONS.join(", ")})`);
  return nom;
}

export function verifierTaille(octets: number): void {
  if (octets > TAILLE_MAX) throw new Error(`Image trop lourde (${Math.ceil(octets / 1024)} Ko, maximum 200 Ko)`);
}

// Ouvre le sélecteur ; retourne la valeur du champ logo (producteurs/nom) ou null si annulé. Rien n'est copié ici.
export async function choisirLogo(choisir: () => Promise<string | null>): Promise<string | null> {
  const source = await choisir();
  if (!source) return null;
  const nom = nomLogo(source);
  verifierTaille(fs.statSync(source).size);
  enAttente = { source, nom };
  return `producteurs/${nom}`;
}

// Copie (local) ou envoie (FTP) l'image choisie dans upload/producteurs/ ; retourne la valeur du champ logo
export async function envoyerLogo(): Promise<string> {
  if (!enAttente) throw new Error("Aucune image sélectionnée");
  const { source, nom } = enAttente;
  const octets = fs.readFileSync(source);
  verifierTaille(octets.length);
  // Import différé : parametres.ts dépend d'Electron, ce qui empêche de tester les fonctions pures sous node seul
  const { getParametresLogo } = await import("./parametres.js");
  const cible = getParametresLogo(nom);
  await avecAcces(cible, (_lire, ecrire) => ecrire(cheminFichier(cible), octets), true);
  return `producteurs/${nom}`;
}

import { avecAcces, cheminFichier, echapper, parserCsv, SEP } from "./producteurCsv.js";

export interface Correspondance { code: string; libelle: string }

// Liste blanche : jamais de nom venu du renderer dans un chemin
export const NOMS = ["conditionnements", "tailles"] as const;
export type Nom = (typeof NOMS)[number];

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function decoder(octets: Buffer, fichier: string): { bom: boolean; texte: string } {
  const bom = octets.subarray(0, 3).equals(BOM);
  try {
    return { bom, texte: new TextDecoder("utf-8", { fatal: true }).decode(octets.subarray(bom ? 3 : 0)) };
  } catch {
    throw new Error(`${fichier} : encodage UTF-8 attendu`);
  }
}

const encoder = (bom: boolean, texte: string) => Buffer.from((bom ? "﻿" : "") + texte, "utf8");
const finDeLigne = (texte: string) => (/\r\n/.test(texte) ? "\r\n" : /\n/.test(texte) ? "\n" : /\r/.test(texte) ? "\r" : "\r\n");
const finNl = (texte: string) => /[\r\n]$/.test(texte);

// 1re colonne = code, 2e = libellé ; 1re ligne = en-têtes (exclue), lignes vides ignorées
export function lireCsv(octets: Buffer): Correspondance[] {
  const lignes = parserCsv(decoder(octets, "CSV").texte);
  if (!lignes.length) throw new Error("CSV : en-têtes manquants");
  return lignes
    .slice(1)
    .filter((l) => l.some((v) => v.trim()))
    .map((l) => ({ code: l[0] ?? "", libelle: l[1] ?? "" }));
}

// En-têtes, BOM, fin de ligne et saut de ligne final du fichier d'origine conservés
export function ecrireCsv(octetsOrigine: Buffer, lignes: Correspondance[]): Buffer {
  const { bom, texte } = decoder(octetsOrigine, "CSV");
  const bornes: [number, number][] = [];
  if (!parserCsv(texte, bornes).length) throw new Error("CSV : en-têtes manquants");
  const entetes = texte.slice(0, bornes[0][1]).replace(/[\r\n]+$/, "");
  const eol = finDeLigne(texte);
  const corps = [entetes, ...lignes.map((l) => [l.code, l.libelle].map(echapper).join(SEP))].join(eol);
  return encoder(bom, corps + (finNl(texte) ? eol : ""));
}

const entites: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const echapperXml = (v: string) => v.replace(/[&<>"']/g, (c) => entites[c]);

// ponytail: structure fixe <root><row><code/><libelle/></row></root> relevée sur les fichiers réels ; fast-xml-parser si elle se complexifie
// Déclaration <?xml?>, BOM, fin de ligne et saut de ligne final de l'XML d'origine conservés
export function ecrireXml(octetsOrigine: Buffer, lignes: Correspondance[]): Buffer {
  const { bom, texte } = decoder(octetsOrigine, "XML");
  if (!/<root\s*>/.test(texte) || !/<\/root>/.test(texte)) throw new Error("XML : structure inattendue (<root> attendu)");
  const declaration = /^\s*<\?xml[^>]*\?>/.exec(texte)?.[0].trim() ?? '<?xml version="1.0" encoding="utf-8"?>';
  const eol = finDeLigne(texte);
  const rows = lignes.map(
    (l) => `<row>${eol}  <code>${echapperXml(l.code)}</code>${eol}  <libelle>${echapperXml(l.libelle)}</libelle>${eol}</row>`,
  );
  const corps = [declaration, "<root>", ...rows, "</root>"].join(eol);
  return encoder(bom, corps + (finNl(texte) ? eol : ""));
}

// Code et libellé obligatoires, codes uniques (comparaison sur le code sans espaces autour, sensible à la casse)
export function valider(lignes: Correspondance[]): void {
  const vus = new Set<string>();
  lignes.forEach((l, i) => {
    const code = l.code.trim();
    if (!code) throw new Error(`Ligne ${i + 1} : le code est obligatoire`);
    if (!l.libelle.trim()) throw new Error(`Code « ${code} » : le libellé est obligatoire`);
    if (vus.has(code)) throw new Error(`Code « ${code} » en doublon`);
    vus.add(code);
  });
}

const verifierNom = (nom: string): Nom => {
  if (!(NOMS as readonly string[]).includes(nom)) throw new Error("Correspondance inconnue");
  return nom as Nom;
};

export async function lireCorrespondances(nom: Nom): Promise<Correspondance[]> {
  // Import différé : parametres.ts dépend d'Electron, ce qui empêche de tester les fonctions pures sous node seul
  const { getParametresLiaison } = await import("./parametres.js");
  const csv = getParametresLiaison(`${verifierNom(nom)}.csv`);
  return avecAcces(csv, async (lire) => lireCsv(await lire(cheminFichier(csv))));
}

// CSV et XML réécrits ensemble : contenus calculés avant toute écriture ; si l'XML échoue, le CSV est restauré
export async function enregistrerCorrespondances(nom: Nom, lignes: Correspondance[]): Promise<void> {
  const { getParametresLiaison } = await import("./parametres.js");
  verifierNom(nom);
  const propres = lignes.map((l) => ({ code: l.code.trim(), libelle: l.libelle.trim() }));
  valider(propres);
  const csv = getParametresLiaison(`${nom}.csv`);
  const xml = getParametresLiaison(`${nom}.xml`);
  const [cheminCsv, cheminXml] = [cheminFichier(csv), cheminFichier(xml)];
  await avecAcces(csv, async (lire, ecrire) => {
    const csvOrigine = await lire(cheminCsv);
    const nouveauCsv = ecrireCsv(csvOrigine, propres);
    const nouveauXml = ecrireXml(await lire(cheminXml), propres);
    await ecrire(cheminCsv, nouveauCsv);
    try {
      await ecrire(cheminXml, nouveauXml);
    } catch (e) {
      const cause = e instanceof Error ? e.message : String(e);
      try {
        await ecrire(cheminCsv, csvOrigine);
      } catch {
        throw new Error(`XML non écrit et CSV non restauré, fichiers désynchronisés : ${cause}`);
      }
      throw new Error(`XML non écrit, CSV restauré : ${cause}`);
    }
  });
}

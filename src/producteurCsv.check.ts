// Vérification sans framework : npm run build && node dist/producteurCsv.check.js
import assert from "node:assert/strict";
import { ajouterLigne, echapper } from "./producteurCsv.js";

const txt = (b: Buffer | null) => b!.toString("utf8");
const p = { id: 12, entreprise: "Ferme du Soleil", email: "contact@ferme.fr" };

assert.equal(echapper("a;b"), '"a;b"');
assert.equal(echapper('dit "oui"'), '"dit ""oui"""');
assert.equal(echapper("simple"), "simple");

// CRLF conservé, ligne en fin de fichier
assert.equal(txt(ajouterLigne(Buffer.from("id;entreprise;email\r\n1;A;a@a.fr\r\n"), p)),
  "id;entreprise;email\r\n1;A;a@a.fr\r\n12;Ferme du Soleil;contact@ferme.fr\r\n");
// LF conservé, saut de ligne final manquant ajouté
assert.equal(txt(ajouterLigne(Buffer.from("id;entreprise;email\n1;A;a@a.fr"), p)),
  "id;entreprise;email\n1;A;a@a.fr\n12;Ferme du Soleil;contact@ferme.fr\n");
// placement par en-tête, autres colonnes vides, BOM conservé
const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("email;tel;id;entreprise\n")]);
const r = ajouterLigne(bom, { ...p, entreprise: "A;B" })!;
assert.deepEqual([...r.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
assert.equal(txt(r.subarray(3)), 'email;tel;id;entreprise\ncontact@ferme.fr;;12;"A;B"\n');
// valeur entre guillemets sur plusieurs lignes dans le fichier : l'id suivant n'est pas confondu
assert.equal(txt(ajouterLigne(Buffer.from('id;entreprise;email\n1;"x\n12;y";a@a.fr\n'), p)).endsWith("12;Ferme du Soleil;contact@ferme.fr\n"), true);
// id déjà présent : reprise (même entreprise+email) ou erreur
const deja = Buffer.from("id;entreprise;email\n12;Ferme du Soleil;contact@ferme.fr\n");
assert.equal(ajouterLigne(deja, p), null);
assert.throws(() => ajouterLigne(deja, { ...p, email: "autre@ferme.fr" }), /Id déjà utilisé/);
// id présent avec « Non défini » : ligne remplacée sur place, le reste du fichier est intact
assert.equal(txt(ajouterLigne(Buffer.from("id;entreprise;email\r\n11;A;a@a.fr\r\n12;Non défini;\r\n13;B;b@b.fr\r\n"), p)),
  "id;entreprise;email\r\n11;A;a@a.fr\r\n12;Ferme du Soleil;contact@ferme.fr\r\n13;B;b@b.fr\r\n");
assert.equal(txt(ajouterLigne(Buffer.from("id;entreprise;email\n12;Non défini;"), p)),
  "id;entreprise;email\n12;Ferme du Soleil;contact@ferme.fr");
// en-tête manquant, encodage invalide
assert.throws(() => ajouterLigne(Buffer.from("id;nom\n"), p), /entreprise/);
assert.throws(() => ajouterLigne(Buffer.from([0x69, 0x64, 0xe9]), p), /UTF-8/);

console.log("producteurCsv : OK");

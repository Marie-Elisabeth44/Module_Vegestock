// Vérification sans framework : npm run build && node dist/correspondances.check.js
import assert from "node:assert/strict";
import { ecrireCsv, ecrireXml, lireCsv, valider } from "./correspondances.js";

const txt = (b: Buffer) => b.toString("utf8");
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const l = (code: string, libelle: string) => ({ code, libelle });

// lecture : avec/sans BOM, CRLF/LF, lignes vides ignorées, en-têtes exclus
const csv = Buffer.concat([BOM, Buffer.from("code;libelle\r\nNP;non précisé\r\n\r\n001;Conteneur de 1 Litre")]);
assert.deepEqual(lireCsv(csv), [l("NP", "non précisé"), l("001", "Conteneur de 1 Litre")]);
assert.deepEqual(lireCsv(Buffer.from("code;libelle\nA;b\n")), [l("A", "b")]);
assert.throws(() => lireCsv(Buffer.from([0x69, 0xe9])), /UTF-8/);

// valeurs avec ; guillemets accents & < : aller-retour CSV
const dures = [l("A;1", 'dit "oui"'), l("B", "é & <b>")];
const origine = Buffer.concat([BOM, Buffer.from("code;libelle\r\nX;y\r\n")]);
const ecrit = ecrireCsv(origine, dures);
assert.deepEqual([...ecrit.subarray(0, 3)], [...BOM]);
assert.equal(txt(ecrit.subarray(3)), 'code;libelle\r\n"A;1";"dit ""oui"""\r\nB;é & <b>\r\n');
assert.deepEqual(lireCsv(ecrit), dures);

// CSV : LF et absence de saut final conservés ; idempotence
const lf = Buffer.from("code;libelle\nA;b");
assert.equal(txt(ecrireCsv(lf, [l("A", "b"), l("C", "d")])), "code;libelle\nA;b\nC;d");
const sansVide = Buffer.concat([BOM, Buffer.from("code;libelle\r\nNP;non précisé\r\n001;Conteneur de 1 Litre")]);
assert.equal(ecrireCsv(sansVide, lireCsv(sansVide)).equals(sansVide), true);
assert.equal(txt(ecrireCsv(csv, lireCsv(csv)).subarray(3)), "code;libelle\r\nNP;non précisé\r\n001;Conteneur de 1 Litre"); // ligne vide supprimée

// XML : structure, entités, déclaration / BOM / fin de ligne conservés, idempotence
const xml = Buffer.from('<?xml version="1.0" encoding="utf-8"?>\r\n<root>\r\n<row>\r\n  <code>NP</code>\r\n  <libelle>non précisé</libelle>\r\n</row>\r\n</root>');
assert.equal(ecrireXml(xml, [l("NP", "non précisé")]).equals(xml), true);
assert.equal(txt(ecrireXml(xml, [l("A&B", "<x> \"y\" 'z'")])),
  '<?xml version="1.0" encoding="utf-8"?>\r\n<root>\r\n<row>\r\n  <code>A&amp;B</code>\r\n  <libelle>&lt;x&gt; &quot;y&quot; &apos;z&apos;</libelle>\r\n</row>\r\n</root>');
assert.equal(txt(ecrireXml(xml, [])), '<?xml version="1.0" encoding="utf-8"?>\r\n<root>\r\n</root>');
assert.throws(() => ecrireXml(Buffer.from("<autre/>"), []), /structure/);

// validation : vides, doublon (casse et espaces), message nommant le code
valider([l("1A", "a"), l("1a", "b")]);
assert.throws(() => valider([l("1A", "a"), l(" 1A ", "b")]), /« 1A » en doublon/);
assert.throws(() => valider([l("  ", "a")]), /code est obligatoire/);
assert.throws(() => valider([l("X", " ")]), /libellé est obligatoire/);

console.log("correspondances : OK");

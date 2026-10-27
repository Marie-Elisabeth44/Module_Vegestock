import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
const URL_DEFAUT = "http://local.vegestock/api/producteurs.php";
const fichier = () => path.join(app.getPath("userData"), "parametres.json");
function lire() {
    try {
        return { url: URL_DEFAUT, jeton: "", ...JSON.parse(fs.readFileSync(fichier(), "utf8")) };
    }
    catch {
        return { url: URL_DEFAUT, jeton: "" };
    }
}
// Utilisé côté main uniquement : le jeton ne part jamais vers le renderer.
export function getParametres() {
    const s = lire();
    const jeton = s.jeton ? safeStorage.decryptString(Buffer.from(s.jeton, "base64")) : "";
    return { url: s.url, jeton };
}
export function getParametresPublics() {
    const s = lire();
    return { url: s.url, jetonDefini: !!s.jeton };
}
// jeton vide = on conserve l'actuel
export function saveParametres(url, jeton) {
    if (!/^https?:\/\//i.test(url))
        throw new Error("URL invalide : elle doit commencer par http:// ou https://");
    if (jeton && !safeStorage.isEncryptionAvailable())
        throw new Error("Chiffrement indisponible sur ce poste");
    const actuel = lire();
    const stocke = {
        url,
        jeton: jeton ? safeStorage.encryptString(jeton).toString("base64") : actuel.jeton,
    };
    fs.writeFileSync(fichier(), JSON.stringify(stocke));
}

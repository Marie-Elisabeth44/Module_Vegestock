// URL du JSON généré par le site Vegestock (à confirmer)
const URL_PRODUCTEURS = "http://local.vegestock/api/producteurs.php";
const CHAMPS = [
    "id", "entreprise", "email", "logo", "adresse", "codepostal", "ville", "telephone", "fax", "actif",
];
export async function getProducteurs() {
    const res = await fetch(URL_PRODUCTEURS, { headers: { Accept: "application/json" } });
    if (!res.ok)
        throw new Error(`Le site a répondu ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data))
        throw new Error("JSON invalide : un tableau est attendu");
    data.forEach((p, i) => {
        const manquants = CHAMPS.filter((c) => typeof p !== "object" || p === null || !(c in p));
        if (manquants.length)
            throw new Error(`Producteur n°${i + 1} : champs manquants (${manquants.join(", ")})`);
    });
    return data;
}

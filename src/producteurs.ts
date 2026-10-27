import { getParametres } from "./parametres.js";

export interface Producteur {
  id: number;
  entreprise: string;
  email: string;
  logo: string;
  adresse: string;
  codepostal: string;
  ville: string;
  telephone: string;
  fax: string;
  actif: number;
  latitude?: number | null;
  longitude?: number | null;
}

const CHAMPS: (keyof Producteur)[] = [
  "id", "entreprise", "email", "logo", "adresse", "codepostal", "ville", "telephone", "fax", "actif",
];

// Affichage : apostrophes ' et ’ ; base : entités numériques (' ↔ &#39;, ’ ↔ &#8217;). Les autres caractères (accents) sont envoyés tels quels.
export const encoder = (s: string) => s.replace(/['’]/g, (c) => `&#${c.charCodeAt(0)};`);
export const decoder = (s: string) =>
  s.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) =>
    String.fromCodePoint(/^x/i.test(n) ? parseInt(n.slice(1), 16) : Number(n)));

function mapTexte(p: Producteur, f: (s: string) => string): Producteur {
  const r: Record<string, unknown> = { ...p };
  for (const c of CHAMPS) if (c !== "id" && c !== "actif" && typeof r[c] === "string") r[c] = f(r[c] as string);
  return r as unknown as Producteur;
}

// Coordonnées via l'API Adresse (BAN) ; null si adresse vide, introuvable ou service indisponible
async function geocoder(p: Producteur): Promise<{ latitude: number; longitude: number } | null> {
  const q = [p.adresse, p.ville].filter(Boolean).join(" ").trim();
  if (!q) return null;
  try {
    const u = new URL("https://api-adresse.data.gouv.fr/search/");
    u.searchParams.set("q", q);
    if (p.codepostal) u.searchParams.set("postcode", p.codepostal);
    u.searchParams.set("limit", "1");
    const res = await fetch(u, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const [longitude, latitude] = (await res.json()).features?.[0]?.geometry?.coordinates ?? [];
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  } catch {
    return null;
  }
}

// Corps JSON de la réponse ; erreur lisible si le site renvoie autre chose (erreur PHP)
async function lireJson<T>(res: Response): Promise<T> {
  const texte = await res.text();
  try { return JSON.parse(texte); } catch { /* réponse non JSON */ }
  const brut = texte.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  throw new Error(`Réponse non JSON du site (${res.status}) : ${brut}`);
}

// Endpoints d'écriture voisins de celui de lecture (voir spec/evolution_site.md)
async function envoyerProducteur(
  endpoint: string,
  p: Producteur,
  emailObligatoire: boolean,
): Promise<Producteur & { avertissement?: string }> {
  const manquants = CHAMPS.filter((c) => !(c in p));
  if (manquants.length) throw new Error(`Champs manquants (${manquants.join(", ")})`);
  if (!Number.isInteger(p.id)) throw new Error("Identifiant invalide");
  if (!String(p.entreprise).trim()) throw new Error("Le nom de l'entreprise est obligatoire");
  if (emailObligatoire && !String(p.email).trim()) throw new Error("L'email est obligatoire");
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) throw new Error("Email invalide");
  const { url, jeton } = getParametres();
  const coord = await geocoder(p);
  const res = await fetch(new URL(endpoint, url), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({
      ...Object.fromEntries(CHAMPS.map((c) => [c, mapTexte(p, encoder)[c]])),
      latitude: coord?.latitude ?? null,
      longitude: coord?.longitude ?? null,
    }),
  });
  if (res.status === 401) throw new Error("Jeton refusé par le site (401)");
  if (res.status === 404) throw new Error("Producteur introuvable sur le site (404)");
  if (res.status === 409) throw new Error("Identifiant déjà utilisé par un producteur du site (409)");
  const corps = await lireJson<Producteur & { error?: string }>(res);
  if (!res.ok) throw new Error(corps.error ?? `Le site a répondu ${res.status}`);
  return {
    ...mapTexte(corps, decoder),
    ...(coord ? {} : { avertissement: "Adresse non localisée : coordonnées non enregistrées" }),
  };
}

export const updateProducteur = (p: Producteur) => envoyerProducteur("producteur_modifier.php", p, false);

export const ajouterProducteurSite = (p: Producteur) => envoyerProducteur("producteur_ajouter.php", p, true);

// Id à utiliser pour un nouveau producteur (lecture seule côté site)
export async function getIdDisponible(): Promise<number> {
  const { url, jeton } = getParametres();
  const res = await fetch(new URL("producteur_id_disponible.php", url), {
    headers: { Accept: "application/json", Authorization: `Bearer ${jeton}` },
  });
  if (res.status === 401) throw new Error("Jeton refusé par le site (401)");
  const corps = await lireJson<{ id?: unknown; error?: string }>(res);
  if (!res.ok) throw new Error(corps.error ?? `Le site a répondu ${res.status}`);
  if (typeof corps.id !== "number" || !Number.isInteger(corps.id) || corps.id < 1) {
    throw new Error("Réponse invalide du site : id disponible attendu");
  }
  return corps.id;
}

export async function getProducteurs(): Promise<Producteur[]> {
  const { url, jeton } = getParametres();
  const res = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${jeton}` },
  });
  if (res.status === 401) throw new Error("Jeton refusé par le site (401)");
  if (!res.ok) throw new Error(`Le site a répondu ${res.status}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error("JSON invalide : un tableau est attendu");
  data.forEach((p, i) => {
    const manquants = CHAMPS.filter((c) => typeof p !== "object" || p === null || !(c in p));
    if (manquants.length) throw new Error(`Producteur n°${i + 1} : champs manquants (${manquants.join(", ")})`);
  });
  return (data as Producteur[]).map((p) => mapTexte(p, decoder));
}

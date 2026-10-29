# Liste des producteurs : lecture du JSON et affichage dans un tableau

## Périmètre

Ce projet lit le JSON des producteurs, l'affiche, et permet de **modifier** (voir « Gestion des producteurs ») et d'**ajouter** (voir « Ajout d'un producteur ») un producteur. La génération du JSON et l'écriture en base se font dans le site Vegestock (`http://local.vegestock`) et ne sont **pas** implémentées ici.

## Contrat avec le site (à fournir par le site)

Une URL (ex. `http://local.vegestock/api/producteurs.php`) renvoie, en `application/json; charset=utf-8`, un tableau issu de la table `t_producteurs` (pluriel) :

```json
[
  {"id":1,"entreprise":"…","email":"…","logo":"…","adresse":"…","codepostal":"…","ville":"…","telephone":"…","fax":"…","actif":1}
]
```

Champs attendus : `id, entreprise, email, logo, adresse, codepostal, ville, telephone, fax, actif`.
L'URL est protégée par un jeton : l'appli l'envoie en `Authorization: Bearer …` (confirmé ; le site répond `401 {"error":"unauthorized"}` sinon). Le site renvoie **tous** les producteurs, `actif` compris : le filtrage est fait côté appli. Côté site : `api/producteurs.php` et `config/api.php` (jeton, non versionné).

## Côté application

État actuel : `getProducteurs()`, l'IPC `producteurs:list` et le preload sont en place. L'onglet « Paramètres » enregistre l'URL et le jeton (chiffré). Le renderer n'accède pas au réseau (CLAUDE.md) : tout passe par `main` + IPC.

Aucune nouvelle dépendance : `fetch` natif.

- `src/producteurs.ts` (main) : `getProducteurs()` → `fetch(url)`, vérifie `res.ok`, `await res.json()`, valide que c'est un tableau d'objets avec les 10 champs (type `Producteur`), sinon erreur claire.
- `src/main.ts` : `ipcMain.handle("producteurs:list", getProducteurs)` ; ajouter `preload` dans `webPreferences`.
- `src/preload.cts` : `contextBridge.exposeInMainWorld("api", { listProducteurs: () => ipcRenderer.invoke("producteurs:list") })`.
- `src/renderer/index.html` : tableau à 10 colonnes ; au chargement `const rows = await api.listProducteurs()` puis construction des `<tr>` avec `textContent` (jamais `innerHTML` : données distantes). `actif` → Oui/Non. `logo` : `<img>` seulement si l'URL est du site. Message d'erreur visible si l'appel échoue.
- URL et jeton : onglet « Paramètres » (`src/parametres.ts`). Le jeton est chiffré via `safeStorage` (DPAPI) dans `userData/parametres.json` et ne remonte jamais au renderer. Un 401 affiche « Jeton refusé par le site ».

Note CSP : pour afficher les logos depuis le site, ajouter `img-src http://local.vegestock`.

## Gestion des producteurs

### Web service d'écriture (à fournir par le site)

Oui, un web service est nécessaire : l'appli n'accède jamais directement à la base (CLAUDE.md : tout passe par l'API du site, pas de MySQL ouvert vers les postes clients).

`POST /api/producteur_modifier.php`, même jeton `Authorization: Bearer …`, corps JSON :

```json
{"id":1,"entreprise":"…","email":"…","logo":"…","adresse":"…","codepostal":"…","ville":"…","telephone":"…","fax":"…","actif":1}
```

- `id` sert uniquement à cibler la ligne ; il n'est **jamais** modifié.
- Le site fait un `UPDATE t_producteurs SET … WHERE id = ?` en **requête préparée**.
- Le site valide aussi (`entreprise` obligatoire, `email` valide, `actif` ∈ {0,1}) : la validation côté appli ne suffit pas.
- Réponses : `200` + producteur à jour ; `400 {"error":"…"}` validation ; `401` jeton ; `404` id inconnu.

#### Informations concernant la localisation du producteur sur une carte.
Afin de localiser le producteur sur une carte, il est nécessaire de lui infiquer la longitude et la latitude. Ces 2 informations peuvent être récupérées à partir de l'adresse complète indiquée dans les rubriques adresse codepostal et ville.
Avant d'appeler le web_service, il fauit récupérer ces 2 informations et les indiquer dans le json.

Mise en œuvre : `geocoder()` dans `src/producteurs.ts` (côté `main`) interroge l'API Adresse (BAN, `https://api-adresse.data.gouv.fr/search/`, gratuite, sans clé) avec adresse + ville + code postal saisis (valeurs non encodées) et ajoute `"latitude"` et `"longitude"` au JSON du POST. Les coordonnées sont calculées, pas saisies : elles n'apparaissent pas dans la fiche. En cas d'échec (adresse vide ou introuvable, service indisponible, délai de 5 s dépassé), les deux valeurs sont envoyées à `null`, l'enregistrement a lieu quand même et un avertissement « Adresse non localisée : coordonnées non enregistrées » s'affiche au-dessus de la liste. Côté site : voir `spec/evolution_site.md`.

### Côté application

1. **Tri** : clic sur l'en-tête `id`, `entreprise` ou `actif`. 1er clic ascendant, 2e clic descendant, indicateur ▲/▼. Tri dans le renderer sur les données déjà chargées (pas d'appel réseau) ; `id` et `actif` numériques, `entreprise` via `localeCompare("fr")`.
2. **Colonne [modifier]** : 11e colonne, un bouton par ligne.
3. **Fiche producteur** : le clic affiche un formulaire (même `index.html`) pré-rempli ; `id` en lecture seule, les 9 autres champs modifiables (`actif` = case à cocher) ; boutons Enregistrer / Annuler.
4. **Enregistrement** : renderer → IPC `producteurs:update` → `main` → `updateProducteur()` dans `src/producteurs.ts` (`fetch` POST + jeton) → site. Validation locale avant envoi (mêmes règles que le site). Succès : retour à la liste rechargée. Erreur (400/401/404/réseau) : message dans la fiche, saisie conservée.
5. Fichiers touchés : `src/producteurs.ts`, `src/main.ts`, `src/preload.cts` (`updateProducteur`), `src/renderer/index.html`. Toujours `textContent`/`value`, jamais `innerHTML`.
6. **Apostrophes et entités numériques** : à l'écran (liste et fiche) les apostrophes sont affichées telles quelles (`'` et `’`) ; en base elles sont stockées sous forme d'entités numériques (`'` → `&#39;`, `’` → `&#8217;`). Seules les apostrophes sont encodées : les caractères accentués sont envoyés tels quels. La conversion est centralisée dans `src/producteurs.ts` (côté `main`) : `encoder()` remplace `'` et `’` par leur entité avant l'envoi du POST ; `decoder()` convertit toute entité numérique `&#NNN;` / `&#xHH;` en caractère à la lecture (liste et réponse de l'update). Le renderer ne voit jamais d'entités. Les champs `id` et `actif` ne sont pas concernés ; un `&` littéral est laissé tel quel. La validation locale se fait sur la valeur saisie (non encodée). Le site stocke la valeur reçue sans la ré-encoder. Il est important de convertir l'apostrophe afin de pouvoir afficher la carte pour indiquer la localisation du producteur.

## Ajout d'un producteur

Détail et décisions : `work/ajout_producteur/spec.md` et `plan.md`. Résumé de ce qui est implémenté côté application (le site fournit `GET /api/producteur_id_disponible.php` et `POST /api/producteur_ajouter.php`, même jeton Bearer) :

1. **Liste** : champ de recherche (sur `entreprise`, sans casse ni accents, dans le renderer) à gauche et bouton **Ajouter** à droite, au-dessus du tableau.
2. **Id** : [Ajouter] → IPC `producteurs:nextId` → `getIdDisponible()` (`src/producteurs.ts`). Erreur : message au-dessus de la liste, fiche non ouverte.
3. **Fiche** : la même que pour la modification, en mode `ajout` (`id` en lecture seule, `actif` coché, `entreprise` et `email` obligatoires). Enregistrer → IPC `producteurs:add` → `main` valide, puis `ajouterProducteur()` (`src/producteurCsv.ts`) ajoute `id;entreprise;email` à `producteurs.csv`, puis `ajouterProducteurSite()` envoie toutes les données au site (mêmes géocodage et encodage des apostrophes que la modification).
4. **`producteurs.csv`** : séparateur `;`, colonnes repérées par leur nom d'en-tête, UTF-8 (BOM et fin de ligne conservés), `entreprise` encodée comme en base. Id déjà présent : refus « Id déjà utilisé », sauf reprise (mêmes `entreprise` et `email`, rien n'est réécrit, on enchaîne sur le site). Écriture via fichier temporaire puis remplacement.
5. **Emplacement** : onglet « Paramètres », bloc « Fichier producteurs.csv » (`src/parametres.ts`) : chemin local/réseau (bouton « Parcourir… ») ou FTP (hôte, port, utilisateur, mot de passe chiffré par `safeStorage`, chemin distant). En FTP : téléchargement dans un répertoire temporaire, ajout de la ligne, envoi sous `.tmp` puis contrôle de taille et renommage. FTP en clair (pas de FTPS pour l'instant).
6. Dépendance ajoutée : `basic-ftp`. Vérification de `producteurCsv.ts` : `npm run build && node dist/producteurCsv.check.js`.

## Correspondances : conditionnements et tailles

Détail et décisions : `work/ajout_correspondance/spec.md` et `plan.md`. Implémenté côté application uniquement (aucun web service) :

1. **Fichiers** : `conditionnements.csv/.xml` et `tailles.csv/.xml` dans le sous-dossier `liaisons/` du dossier de `producteurs.csv`, en chemin local ou FTP (`getParametresLiaison()`, `src/parametres.ts`). CSV : `;`, UTF-8 avec BOM, CRLF, en-têtes `code;libelle`. XML : `<root><row><code/><libelle/></row></root>`, déclaration, BOM et fin de ligne conservés.
2. **Onglets** Conditionnements et Tailles (une seule fonction `initCorrespondances`) : tableau Code – Libellé éditable, recherche (casse et accents ignorés), **Ajouter une ligne** (en tête), **Enregistrer**. Pas de suppression de lignes.
3. **Validation** (renderer, puis revalidée dans `main`) : code et libellé obligatoires, codes uniques (sensible à la casse). Invalide : refus, rien n'est écrit.
4. **Enregistrement** : IPC `correspondances:list` / `correspondances:save` → `src/correspondances.ts`. Les deux contenus sont calculés avant toute écriture ; CSV écrit puis XML ; si l'XML échoue, le CSV est restauré (sinon message d'incohérence). Écriture sûre via `avecAcces()` (`src/producteurCsv.ts`) : `.tmp` puis remplacement, en FTP contrôle de taille.
5. Vérification : `npm run build && node dist/correspondances.check.js`.

## Vérification

1. `npm run typecheck` puis `npm start` → onglet Producteurs rempli avec le JSON du site.
2. Site coupé ou JSON invalide → message d'erreur dans l'appli, pas de plantage.
3. Clic sur `id`, `entreprise`, `actif` → liste triée, second clic inverse l'ordre.
4. [modifier] → fiche pré-remplie, `id` non éditable ; Enregistrer → liste rechargée avec la nouvelle valeur (persistée côté site).
5. Email invalide → refus ; jeton faux → « Jeton refusé par le site ».
6. Saisir « Ferme de l'Été » dans l'entreprise → le POST contient `Ferme de l&#39;Été` (accents inchangés), la liste et la fiche réaffichent « Ferme de l'Été ».
7. Enregistrer un producteur avec une adresse valide → le POST contient `latitude` et `longitude` renseignées ; réseau coupé ou adresse absurde → enregistrement réussi, coordonnées `null`, avertissement visible.

## À confirmer

- Nom et méthode exacts de l'endpoint d'écriture (`producteur_modifier.php` proposé).
- URL de production (avec `www.`, sinon le 301 du `.htaccess` peut faire perdre l'en-tête `Authorization`).
- HTTPS en production (HTTP acceptable en `local.`).

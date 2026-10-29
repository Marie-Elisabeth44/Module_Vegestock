# Plan : ajout d'un producteur (côté application uniquement)

Source : `work/ajout_producteur/spec.md`. Rien à faire côté site (`producteur_id_disponible.php` et `producteur_ajouter.php` sont supposés exister ; voir « Côté site » de la spec).

Ordre choisi : du bas (main) vers le haut (renderer), pour typechecker à chaque étape.

## Étape 0 : dépendance

- `npm install basic-ftp` (FTP/FTPS).
- CSV : **écriture manuelle** d'une seule ligne, pas de `csv-stringify` ; lecture de l'en-tête et de la colonne `id` avec un petit découpage maison (guillemets gérés). À revoir si le format se complique.

## Étape 1 : `src/parametres.ts` (emplacement de `producteurs.csv`)

- Étendre `Stocke` : `csv: { mode: "chemin" | "ftp" | ""; chemin: string; ftp: { hote, port, utilisateur, mdp, cheminDistant } }` ; `mdp` chiffré `safeStorage` en base64, comme `jeton`. `lire()` fusionne avec des valeurs par défaut (port 21, mode `""`) pour rester compatible avec un `parametres.json` existant.
- `getParametresCsv()` (main uniquement) : retourne la config avec mot de passe déchiffré.
- `getParametresPublics()` : ajouter la config CSV **sans** mot de passe, avec `mdpDefini: boolean`.
- `saveParametres(url, jeton, csv)` : valider (mode chemin → chemin non vide ; mode FTP → hôte, port entier, chemin distant non vides) ; `mdp` vide = conserver l'actuel.
- Jamais de mot de passe dans les logs.

## Étape 2 : `src/producteurs.ts` (accès site)

- `getIdDisponible()` : `GET producteur_id_disponible.php` (URL dérivée de `url` comme `producteur_modifier.php`), jeton Bearer, erreurs 401 / réponse non JSON / `id` non entier positif. Extraire un petit helper commun de lecture de réponse JSON si le copier-coller avec `updateProducteur` est trop gros (parsing « non JSON » déjà écrit à la ligne 72-78).
- `ajouterProducteurSite(p)` : mêmes validations que `updateProducteur` **mais `email` obligatoire**, même `geocoder()` / `encoder()` / `decoder()`, `POST producteur_ajouter.php`, gestion 401 / 400 / 409, avertissement « Adresse non localisée ». Factoriser la partie commune avec `updateProducteur` (paramètre : nom de l'endpoint).

## Étape 3 : `src/producteurCsv.ts` (nouveau)

`ajouterProducteur({ id, entreprise, email })` :

1. Récupérer le fichier : lecture locale (`fs`) ou téléchargement FTP (`basic-ftp`, répertoire temporaire `os.tmpdir()`), selon `getParametresCsv()`. Mode non paramétré → erreur « Emplacement de producteurs.csv non paramétré ».
2. Détecter encodage et fin de ligne existants (UTF-8 avec/sans BOM ; `\r\n` ou `\n`) et les conserver.
3. Lire l'en-tête (séparateur `;`), repérer les colonnes `id`, `entreprise`, `email` **par nom**.
4. Id déjà présent : si mêmes `entreprise` et `email` (après `encoder()`) → reprise, ne rien écrire, retourner ; sinon erreur « Id déjà utilisé ».
5. Construire la ligne (`encoder()` sur `entreprise`, échappement CSV : guillemets si `;`, `"` ou retour ligne, guillemets doublés), l'ajouter en fin de fichier avec saut de ligne final si manquant.
6. Écriture sûre : local = fichier temporaire puis `rename` ; FTP = upload puis contrôle de la taille distante ; en cas d'échec, erreur claire, fichier distant inchangé. Supprimer la copie temporaire dans un `finally`.
- Un check `node`-simple (assert) pour l'échappement et le placement par en-tête, si possible sans Electron (fonctions pures exportées).

## Étape 4 : `src/main.ts` + `src/preload.cts` (IPC)

- `main.ts` :
  - `producteurs:nextId` → `getIdDisponible()`.
  - `producteurs:add` → `ajouterProducteur({id, entreprise, email})` puis `ajouterProducteurSite(p)` ; l'étape CSV est sautée si reprise ; retourner le producteur (+ `avertissement`).
  - `dialog:parcourirCsv` → `dialog.showOpenDialog` (filtre `.csv`), retourne le chemin ou `null`.
  - `parametres:save` : nouvelle signature avec la config CSV.
- `preload.cts` : `nextIdProducteur`, `addProducteur`, `parcourirCsv`, `saveParametres` étendu.
- Valider les arguments IPC (`String(...)`, `Number.isInteger`) comme existant.

## Étape 5 : `src/renderer/index.html` (UI)

À lire d'abord (non relu pour ce plan) : structure de `#producteurs`, `#fiche`, `afficherProducteurs()`, onglet Paramètres.

1. **Barre** au-dessus du tableau : `display:flex; justify-content:space-between` ; `<input type="search" placeholder="Rechercher une entreprise">` à gauche, bouton **Ajouter** à droite.
2. **Recherche** : filtre sur `entreprise`, `normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()`, « contient », à chaque `input` ; `afficherProducteurs()` = filtre puis tri ; ligne « Aucun producteur trouvé » si vide.
3. **Mode de la fiche** : variable `mode = "ajout" | "modif"`.
   - Ajout : clic → `nextIdProducteur()` ; erreur → message au-dessus de la liste, fiche non ouverte ; succès → fiche vierge, `id` en lecture seule, `actif` coché.
   - Enregistrer : valide `entreprise` + `email` (obligatoire, format) en ajout ; appelle `addProducteur` ou `updateProducteur` selon le mode ; erreur → message dans la fiche, saisie conservée ; succès → fermer la fiche, recharger la liste.
   - Annuler : ferme sans rien écrire.
4. **Paramètres** : bloc « Fichier producteurs.csv », radios exclusifs *Chemin* / *FTP* ; chemin + bouton « Parcourir… » ; champs FTP (hôte, port 21, utilisateur, mot de passe vide = conserver, chemin distant). Afficher/masquer selon le radio. « Tester » : hors première version.
5. `textContent` / `value` uniquement, jamais `innerHTML`.

## Étape 6 : docs

- `CLAUDE.md` : ajouter `producteurCsv.ts` dans « Structure prévue », `basic-ftp` dans la stack, retirer « Protocole du serveur de fichiers » de « À définir » si tranché.
- `spec/specification.md` : y refléter les nouveautés une fois l'implémentation validée.

## Étape 7 : vérification

Reprendre la liste « Vérification » de la spec (points 1 à 10), avec un `producteurs.csv` local de test (cas : apostrophe `Ferme de l'Été`, `;` dans le nom, fin de ligne CRLF, pas de saut final, id existant, reprise après échec du site) et, pour le FTP, un serveur de test. Terminer par `npm run typecheck`.

## Points à trancher avant / pendant l'implémentation

- **Ordre CSV puis site** : retenu tel que dans la spec ; à confirmer (si le site refuse en 400/409, le CSV contient déjà la ligne). Inverser = changement d'une ligne dans `producteurs:add`.
- **Protocole** : `basic-ftp` couvre FTP/FTPS (`secure: true` à prévoir comme option) ; SFTP demanderait une autre bibliothèque.
- **Réimport CSV → base** par le site : sans lui, le nouveau producteur peut ne pas apparaître dans la liste, mais l'étape 2 (`producteur_ajouter.php`) l'écrit déjà en base.
- **Dépendances côté site** : tant que les deux web services n'existent pas, tester avec un faux serveur local ou en mockant `fetch`.

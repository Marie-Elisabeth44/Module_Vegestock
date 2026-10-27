# Ajout d'un producteur

## Périmètre

Cette évolution ajoute à l'application :

1. un **champ de recherche** sur la liste des producteurs ;
2. un bouton **[Ajouter]** sur la liste ;
3. le **flux d'ajout** d'un producteur : id disponible fourni par le site, fiche à remplir, validation, écriture dans `producteur.csv` ;
4. un **paramètre** (onglet « Paramètres ») localisant `producteur.csv` : chemin de fichier ou FTP.

Le web service qui retourne l'id disponible est à écrire **côté site** (hors dépôt, voir « Côté site »). L'accès réseau, FTP et fichier se fait uniquement côté `main` ; le renderer passe par IPC (preload), conformément à CLAUDE.md.

## Liste des producteurs

Une barre est ajoutée au-dessus du tableau (`#producteurs` dans `src/renderer/index.html`), en flex avec `justify-content: space-between` :

- **À gauche** : champ de recherche (`<input type="search">`, placeholder « Rechercher une entreprise »).
- **À droite** : bouton **[Ajouter]**.

### Recherche

- Porte uniquement sur le champ `entreprise`.
- Filtrage dans le renderer, sur les données déjà chargées (pas d'appel réseau), à chaque frappe.
- Insensible à la casse et aux accents (comparaison sur `normalize("NFD")` sans diacritiques), correspondance « contient ».
- Compatible avec le tri existant : `afficherProducteurs()` applique le filtre puis le tri.
- Champ vide : tous les producteurs sont affichés.
- Aucun résultat : ligne « Aucun producteur trouvé ».

## Flux d'ajout

1. **Id disponible** : clic sur [Ajouter] → IPC `producteurs:nextId` → `main` → `getIdDisponible()` (dans `src/producteurs.ts`, `fetch` GET + jeton Bearer) → site. En cas d'erreur (401, réseau, réponse invalide), un message s'affiche au-dessus de la liste et la fiche n'est pas ouverte.
2. **Fiche** : ouverture de la fiche existante (`#fiche`), vierge, avec `id` déjà renseigné en lecture seule. Les autres champs sont à saisir (`actif` coché par défaut). Boutons Enregistrer / Annuler ; Annuler ferme la fiche sans rien écrire.
3. **Validation** : l'enregistrement n'est possible que si **`entreprise`** et **`email`** sont renseignés et que l'email est valide. Sinon, message dans la fiche, saisie conservée, rien n'est écrit. Les autres champs sont facultatifs. Si les deux sont valides :
   1. `id`, `entreprise` et `email` sont **ajoutés à `producteur.csv`** (voir ci-dessous) ;
   2. **toutes les données** de la fiche (dont `logo`, `adresse`, `codepostal`, `ville`, `telephone`, `fax`, `actif`) sont ensuite enregistrées par le site : `ajouterProducteurSite()` → `POST /api/producteur_ajouter.php` (voir « Côté site »), avec les mêmes traitements que la modification : géocodage (latitude/longitude), encodage des apostrophes et avertissement « Adresse non localisée » (voir `spec/specification.md`) ;
   3. la fiche se ferme et la liste est rechargée.

   Erreur à l'une des deux étapes : message dans la fiche, saisie conservée. Si le CSV est écrit mais que l'étape 2 échoue, un nouvel Enregistrer ne réécrit pas le CSV lorsque l'`id` y figure déjà avec les mêmes `entreprise` et `email` : il reprend à l'étape 2.
4. **Localisation du fichier** : voir « Paramètres ».

La fiche sert à la fois à la modification et à l'ajout : un indicateur de mode (`ajout` / `modif`) détermine l'IPC appelé (`producteurs:add`, qui enchaîne CSV puis `ajouterProducteurSite()`, ou `producteurs:update`). `id` est en lecture seule dans les deux modes.

## Paramètres : localisation de `producteur.csv`

Dans l'onglet « Paramètres » (`src/parametres.ts`), nouveau bloc « Fichier producteur.csv » avec un choix exclusif :

- **Chemin du fichier** : chemin local ou réseau (ex. `C:\vegestock\producteur.csv`), avec bouton « Parcourir… » (dialogue natif ouvert par `main`).
- **FTP** : hôte, port (21 par défaut), utilisateur, mot de passe, chemin distant du fichier (ex. `/data/producteur.csv`).

Fonctionnement en mode FTP : l'appli **télécharge** le fichier dans un répertoire temporaire local, y ajoute la ligne, puis **renvoie** le fichier sur le serveur, et supprime la copie temporaire.

Règles :

- Le mot de passe FTP est chiffré par `safeStorage` (comme le jeton), jamais renvoyé au renderer (champ vide = conserver), jamais écrit dans les logs.
- Si aucun emplacement n'est paramétré, [Ajouter] reste utilisable jusqu'à l'enregistrement, qui échoue avec « Emplacement de producteur.csv non paramétré ».
- Un bouton « Tester » facultatif peut vérifier l'accès (lecture du fichier) ; non bloquant pour la première version.

## Écriture de `producteur.csv`

Format du fichier : séparateur `;`, première ligne = en-têtes `id;entreprise;email`, puis une ligne de données par producteur. Les valeurs sont placées d'après les **noms d'en-têtes** lus dans le fichier, pas d'après des positions codées en dur.

Implémentée dans un module `main` dédié, `src/producteurCsv.ts` : `ajouterProducteur(p)`.

1. Récupérer le fichier (lecture locale ou téléchargement FTP).
2. Vérifier que l'`id` n'existe pas déjà dans le fichier ; sinon erreur « Id déjà utilisé » (aucune écriture), sauf reprise décrite plus haut (mêmes `entreprise` et `email`).
3. Ajouter **une ligne en fin de fichier** (ex. `12;Ferme du Soleil;contact@ferme.fr`), valeurs échappées selon le CSV (valeur contenant `;`, guillemet ou retour ligne entourée de guillemets, guillemets doublés). Conserver l'encodage et la fin de ligne du fichier existant ; ajouter un saut de ligne final s'il manque.
4. Écrire de façon sûre : fichier temporaire puis remplacement (en local) ; en FTP, envoi puis contrôle de la réussite.
5. Les apostrophes de `entreprise` sont encodées comme pour les producteurs existants (`encoder()` : `'` → `&#39;`, `’` → `&#8217;`), voir `spec/specification.md`.

Le fichier d'origine n'est jamais perdu : en cas d'échec du renvoi FTP, une erreur est affichée et le fichier distant n'est pas modifié.

## Côté application : fichiers touchés

- `src/producteurs.ts` : `getIdDisponible()`, `ajouterProducteurSite()` (réutilise `geocoder()`, `encoder()`, `decoder()`).
- `src/producteurCsv.ts` (nouveau) : `ajouterProducteur()`.
- `src/parametres.ts` : paramètres du fichier (mode, chemin, FTP, mot de passe chiffré).
- `src/main.ts` : IPC `producteurs:nextId`, `producteurs:add`, dialogue « Parcourir… ».
- `src/preload.cts` : `nextIdProducteur`, `addProducteur`, et accès aux nouveaux paramètres.
- `src/renderer/index.html` : barre recherche/[Ajouter], mode ajout de la fiche, bloc de paramètres.
- Dépendance à ajouter pour le FTP : `basic-ftp` (FTP/FTPS). `csv-parse` / `csv-stringify` ou écriture manuelle d'une seule ligne, à trancher à l'implémentation.
- Toujours `textContent` / `value`, jamais `innerHTML`.

## Côté site (à ajouter à `spec/evolution_site.md`)

Deux web services sont à écrire dans le projet du site, avec le même jeton `Authorization: Bearer …`.

### `GET /api/producteur_id_disponible.php`

- `200` : `{"id": 123}`, l'id disponible (selon la règle du site : premier enregistrement « Non défini », sinon dernier id + 1).
- `401 {"error":"unauthorized"}` : jeton absent ou faux.
- Lecture seule : l'appel ne crée rien en base.

### `POST /api/producteur_ajouter.php`

Corps JSON, mêmes champs que `producteur_modifier.php` : `{"id":12,"entreprise":"…","email":"…","logo":"…","adresse":"…","codepostal":"…","ville":"…","telephone":"…","fax":"…","actif":1,"latitude":48.856614,"longitude":2.352222}`.

- **Requête SQL** : si un enregistrement `t_producteurs` d'`id` donné existe avec le nom « Non défini », il est **mis à jour** ; si l'`id` n'existe pas (dernier id + 1), il est **inséré** ; requête préparée dans les deux cas.
- **Validation** (aussi côté site) : `entreprise` obligatoire, `email` obligatoire et valide, `actif` ∈ {0,1}, `latitude`/`longitude` `null` ou numériques dans les bornes (comme `spec/evolution_site.md`).
- **Réponses** : `200` + producteur créé (avec `latitude`/`longitude`) ; `400 {"error":"…"}` validation ; `401` jeton ; `409` id déjà utilisé par un producteur défini (autre que « Non défini »).
- Pas de géocodage côté site : valeurs reçues stockées telles quelles ; apostrophes déjà encodées par l'appli.

## Vérification

1. Taper une partie du nom dans la recherche → liste filtrée, sans tenir compte de la casse ni des accents ; effacer → liste complète ; le tri reste appliqué.
2. [Ajouter] est en haut à droite, la recherche en haut à gauche.
3. Clic [Ajouter] → fiche vierge avec l'`id` retourné par le site, non modifiable.
4. Enregistrer sans entreprise, ou sans email, ou avec un email invalide → refus, rien d'écrit.
5. Enregistrer un producteur valide, mode « chemin » → nouvelle ligne `id;entreprise;email` en fin de `producteur.csv`, bien échappée, et le producteur complet (adresse, etc., avec latitude/longitude) enregistré via `producteur_ajouter.php`.
   - Web service en échec après écriture du CSV → message ; Enregistrer à nouveau ne duplique pas la ligne CSV.
6. Idem en mode FTP → fichier téléchargé, complété, renvoyé ; contrôle sur le serveur.
7. Site coupé ou jeton faux → message, pas de fiche. FTP coupé ou mauvais mot de passe → message dans la fiche, saisie conservée.
8. Id déjà présent dans le CSV → refus.
9. « Ferme de l'Été » → le CSV contient `Ferme de l&#39;Été`.
10. `npm run typecheck` sans erreur.

## À confirmer

- **Ordre CSV puis site** : la spec écrit le CSV d'abord, puis appelle `producteur_ajouter.php`. Si le site refuse (409, 400), le CSV contient déjà la ligne ; la reprise est prévue pour le même `entreprise`/`email` mais pas pour un refus définitif. Faut-il inverser l'ordre (site d'abord, CSV ensuite) ? À confirmer.
- **Protocole** : FTP simple, FTPS ou SFTP ? (le texte parle de FTP ; SFTP demanderait une autre bibliothèque, et FTP en clair est déconseillé hors réseau de confiance).
- **Synchronisation avec la base** : la liste vient de `producteurs.php` (base). Le site réimporte-t-il `producteur.csv` en base ? Sinon le nouveau producteur n'apparaîtra pas dans la liste après ajout.
- **Réservation de l'id** : deux postes peuvent recevoir le même id si l'API ne le réserve pas ; le contrôle de doublon dans le CSV limite le risque.
- **Latitude / longitude** : calculées à l'ajout comme à la modification, puisque `ajouterProducteurSite()` réutilise `geocoder()` ; stockées côté site, pas dans le CSV.

# CLAUDE.md

Ce fichier fournit des instructions à Claude Code (claude.ai/code) pour travailler sur le code de ce dépôt.

# Module Vegestock

Dépôt en démarrage : `src/` contient `main.ts`, `preload.cts`, `producteurs.ts`, `parametres.ts`, `producteurCsv.ts`, `logo.ts` et `renderer/index.html` (liste, modification et ajout de producteurs via l'API du site et `producteurs.csv`, voir `spec/specification.md`). Les correspondances (conditionnements, tailles) sont l'architecture visée, pas du code existant.
Application **Windows** (desktop) de gestion des producteurs d'un site web et des tables de correspondance des produits.
Elle se connecte à un serveur distant (fichiers CSV/XML) et à la base MySQL/MariaDB du site (administrée via phpMyAdmin).

## Fonctionnalités

1. **Ajout d'un producteur** (implémenté, testé OK)
   - L'`id` vient du site (`GET /api/producteur_id_disponible.php`) : premier enregistrement `"Non défini"`, sinon dernier `id` + 1.
   - `ajouterProducteur()` ajoute `id;entreprise;email` à `producteurs.csv`, puis `ajouterProducteurSite()` envoie la fiche au site (`POST /api/producteur_ajouter.php`), qui écrit dans `t_producteurs`. L'appli n'accède jamais à la base.
   - Détail : « Ajout d'un producteur » dans `spec/specification.md`.
2. **Correspondances des conditionnements** (implémenté, à tester manuellement)
   - Lecture de `conditionnements.csv` dans le sous-dossier `liaisons/` du dossier de `producteurs.csv` (local ou FTP), affichage dans un tableau éditable (code, libellé) avec recherche.
   - Ajout de lignes ; à l'enregistrement, réécriture des **deux** fichiers (CSV et XML) ; si l'XML échoue, le CSV est restauré. Codes uniques, code et libellé obligatoires.
   - Détail : `work/ajout_correspondance/spec.md` et `plan.md`.
3. **Logo du producteur** (implémenté)
   - Fiche producteur : boutons « Choisir une image… » (png, jpg, jpeg, gif, webp ; 200 Ko max) et « Retirer ». Le champ `logo` est en lecture seule et vaut `producteurs/<nom>`.
   - Le fichier choisi reste côté main (`logo.ts`, le renderer ne fournit jamais de chemin) ; à l'enregistrement de la fiche, `envoyerLogo()` le copie (local) ou l'envoie (FTP) dans `upload/producteurs/`, dossier frère de celui de `producteurs.csv` (`getParametresLogo()`), créé au besoin (`avecAcces(..., creerDossier)`).
4. **Correspondances des tailles** : même principe avec `tailles.xml` et `tailles.csv`.

Les fonctionnalités 2 et 3 sont identiques (autre nom de fichier) : un seul module générique, paramétré par le nom du fichier (liste blanche `NOMS`).

## Stack (choix de départ, à ajuster)

- Electron + Node.js + TypeScript (ESM, `strict`), compilé avec `tsc` vers `dist/`
- Installées : `electron`, `typescript`, `basic-ftp` (FTP/FTPS pour `producteurs.csv`). À ajouter au besoin : `mysql2` (base), un client SFTP, `fast-xml-parser` (XML), `csv-parse`/`csv-stringify` (CSV ; l'écriture de `producteurs.csv` est faite à la main)
- Interface : HTML/JS simple dans le renderer, pas de framework tant que ce n'est pas nécessaire

## Commandes

- `npm install` — installer les dépendances
- `npm start` — compiler et lancer l'application (saisir URL et jeton dans l'onglet « Paramètres » au premier lancement)
- `npm run typecheck` — vérification des types
- Pas de tests ni de linter pour l'instant

## Structure prévue

- `src/main.ts` — processus principal Electron (fenêtre, IPC, accès réseau/DB)
- `src/producteurs.ts` — `getProducteurs()` : appelle `GET /api/producteurs.php` du site (table `t_producteurs`, `Authorization: Bearer <jeton>`), valide les 10 champs.
- `src/parametres.ts` — URL + jeton de l'API et emplacement de `producteurs.csv` (chemin ou FTP) ; jeton et mot de passe FTP chiffrés par `safeStorage` ; seul `main` les lit.
- `src/logo.ts` — `choisirLogo()` (sélecteur, validation du nom et de la taille) et `envoyerLogo()` (copie ou envoi FTP dans `upload/producteurs/`).
- `src/producteurCsv.ts` — `ajouterProducteur()` : ajoute `id;entreprise;email` à `producteurs.csv` (local ou FTP). Vérification : `npm run build && node dist/producteurCsv.check.js`.
- `src/` — le reste : connexion serveur de fichiers, accès base, lecture/écriture CSV+XML, producteurs
- Les accès réseau et base se font **uniquement côté main** ; le renderer passe par IPC (preload).

## Sécurité (obligatoire)

- Identifiants (serveur de fichiers, base) saisis dans un écran de paramétrage et stockés chiffrés via `safeStorage` d'Electron (DPAPI Windows). Jamais en clair, jamais dans le code ni dans git, jamais dans les logs.
- Requêtes SQL paramétrées uniquement ; utiliser un compte base aux droits minimaux.
- Valider toute saisie (mail, champs obligatoires, doublons de clés dans les correspondances) avant écriture.
- Connexion chiffrée au serveur de fichiers (SFTP/FTPS) et à la base si possible.
- Écrire CSV et XML de façon cohérente : si l'un des deux échoue, ne pas laisser les fichiers désynchronisés (écrire les deux ou signaler l'erreur).

## À définir

- Protocole du serveur de fichiers : `producteurs.csv` fonctionne en chemin local/réseau ou FTP en clair (`basic-ftp`) ; FTPS ou SFTP à confirmer. Chemin des autres fichiers (`conditionnements`, `tailles`) à définir
- Accès à la base : MySQL direct depuis le poste est-il autorisé par l'hébergeur (IP, port 3306) ou faut-il passer par une API/tunnel SSH ?
- Packaging Windows (installeur) : à ajouter plus tard

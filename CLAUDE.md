# CLAUDE.md

Ce fichier fournit des instructions à Claude Code (claude.ai/code) pour travailler sur le code de ce dépôt.

# Module Vegestock

Dépôt à l'état de squelette : `src/` est vide, aucune dépendance installée, pas de dépôt git. Le contenu ci-dessous décrit l'architecture visée, pas du code existant.

Application **Windows** (desktop) de gestion des producteurs d'un site web et des tables de correspondance des produits.
Elle se connecte à un serveur distant (fichiers CSV/XML) et à la base MySQL/MariaDB du site (administrée via phpMyAdmin).

## Fonctionnalités

1. **Ajout d'un producteur** sur le site (écriture en base distante)
   - Calcul de l'`id` : le premier enregistrement dont le nom vaut `"Non défini"` ; s'il n'y en a plus, dernier `id` + 1.
   - À partir de cet `id`, ajout d'un enregistrement dans une table avec **nom, adresse, mail** du producteur.
   - Les noms exacts des tables/colonnes sont à confirmer (voir « À définir »).
2. **Correspondances des conditionnements**
   - Lecture de `conditionnements.xml` et `conditionnements.csv` sur le serveur distant, affichage dans un tableau éditable.
   - Ajout de lignes ; à la validation, réécriture des **deux** fichiers (CSV et XML) sur le serveur.
3. **Correspondances des tailles** : même principe avec `tailles.xml` et `tailles.csv`.

Les fonctionnalités 2 et 3 sont identiques (autre nom de fichier) : un seul module générique, paramétré par le nom du fichier.

## Stack (choix de départ, à ajuster)

- Electron + Node.js + TypeScript (ESM, `strict`), compilé avec `tsc` vers `dist/`
- Dépendances **non encore installées** ; à ajouter au besoin : `electron`, `typescript`, `mysql2` (base), un client FTP/SFTP selon le serveur, `fast-xml-parser` (XML), `csv-parse`/`csv-stringify` (CSV)
- Interface : HTML/JS simple dans le renderer, pas de framework tant que ce n'est pas nécessaire

## Commandes

- `npm install` — installer les dépendances
- `npm start` — compiler et lancer l'application
- `npm run typecheck` — vérification des types
- Pas de tests ni de linter pour l'instant

## Structure prévue

- `src/main.ts` — processus principal Electron (fenêtre, IPC, accès réseau/DB)
- `src/` — le reste : connexion serveur de fichiers, accès base, lecture/écriture CSV+XML, producteurs
- Les accès réseau et base se font **uniquement côté main** ; le renderer passe par IPC (preload).

## Sécurité (obligatoire)

- Identifiants (serveur de fichiers, base) saisis dans un écran de paramétrage et stockés chiffrés via `safeStorage` d'Electron (DPAPI Windows). Jamais en clair, jamais dans le code ni dans git, jamais dans les logs.
- Requêtes SQL paramétrées uniquement ; utiliser un compte base aux droits minimaux.
- Valider toute saisie (mail, champs obligatoires, doublons de clés dans les correspondances) avant écriture.
- Connexion chiffrée au serveur de fichiers (SFTP/FTPS) et à la base si possible.
- Écrire CSV et XML de façon cohérente : si l'un des deux échoue, ne pas laisser les fichiers désynchronisés (écrire les deux ou signaler l'erreur).

## À définir

- Protocole du serveur de fichiers (SFTP, FTP/FTPS, partage…) et chemin des fichiers
- Accès à la base : MySQL direct depuis le poste est-il autorisé par l'hébergeur (IP, port 3306) ou faut-il passer par une API/tunnel SSH ?
- Noms exacts des tables et colonnes des producteurs, et table cible du nom/adresse/mail
- Structure (colonnes, séparateur, encodage) de `conditionnements` et `tailles` en CSV et XML
- Packaging Windows (installeur) : à ajouter plus tard

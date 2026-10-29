# Plan : correspondances conditionnements et tailles (côté application uniquement)

Source : `work/ajout_correspondance/spec.md`. Aucun web service à écrire : tout passe par les fichiers de `liaisons/`, comme `producteurs.csv`.

Ordre : du bas (main) vers le haut (renderer), `npm run typecheck` à chaque étape.

## Étape 0 : prérequis (bloquant pour l'étape 2)

- Récupérer **de vrais** `conditionnements.csv` / `.xml` (et `tailles`) pour relever : séparateur, encodage, fin de ligne, structure XML exacte (racine, nom de l'élément ligne, attributs ou sous-éléments, déclaration `<?xml?>`, indentation).
- Trancher les points « À confirmer » de la spec (chemin `liaisons/`, structure XML).
- Aucune dépendance à ajouter a priori : réutiliser `parserCsv`, `echapper` (`src/producteurCsv.ts`) et `basic-ftp`. XML : écriture par gabarit + échappement des 5 entités si la structure est simple ; `fast-xml-parser` seulement si elle ne l'est pas (attributs, éléments imbriqués à conserver).

## Étape 1 : emplacement des fichiers (`src/parametres.ts`)

- Pas de nouveau paramètre : le dossier se **déduit** de l'emplacement de `producteurs.csv` (`getParametresCsv()`).
  - mode `chemin` : `path.join(path.dirname(chemin), "liaisons", nom)`
  - mode `ftp` : `path.posix.join(path.posix.dirname(cheminDistant), "liaisons", nom)`
- Mode `""` → erreur « Emplacement de producteurs.csv non paramétré » (même message que l'ajout de producteur).

## Étape 2 : `src/correspondances.ts` (nouveau, module générique)

`type Correspondance = { code: string; libelle: string }`, `type Nom = "conditionnements" | "tailles"` (liste blanche : jamais de nom venu du renderer dans un chemin).

Fonctions **pures** (testables sous node seul, imports différés des modules Electron comme `producteurCsv.ts`) :

- `lireCsv(octets): { entetes: string[]; lignes: Correspondance[] }` : détecte BOM / UTF-8 strict, `parserCsv`, ignore les lignes vides, 1re ligne = en-têtes.
- `ecrireCsv(octetsOrigine, lignes): Buffer` : conserve en-têtes, BOM, fin de ligne et saut final du fichier d'origine ; `echapper` sur chaque valeur.
- `ecrireXml(octetsOrigine, lignes): Buffer` : même structure que l'XML existant, contenu remplacé ; entités échappées ; encodage / déclaration conservés.
- `valider(lignes)` : code et libellé non vides (après `trim`), codes **uniques** (comparaison sur le code `trim`, sensible à la casse sauf demande contraire) ; erreur nommant le code en doublon.

Fonctions d'accès (main) :

- `lireCorrespondances(nom)` : lit `<nom>.csv` (local ou FTP, répertoire temporaire) → `Correspondance[]`.
- `enregistrerCorrespondances(nom, lignes)` :
  1. `valider(lignes)` (revalidation côté main, ne pas se fier au renderer) ;
  2. lire les **deux** fichiers d'origine (CSV et XML) en mémoire ;
  3. calculer les deux nouveaux contenus **avant** toute écriture (si l'un échoue à la génération, rien n'est écrit) ;
  4. écrire le CSV (sûr : `.tmp` puis `rename` ; FTP : envoi sous nom temporaire, contrôle de taille, `rename`, comme `surFtp`) ;
  5. écrire le XML de la même façon ; **s'il échoue, restaurer le CSV** avec les octets d'origine, puis lever l'erreur (« XML non écrit, CSV restauré » ou, si la restauration échoue aussi, message explicite d'incohérence).
- Factoriser avec `producteurCsv.ts` le transfert FTP (connexion, téléchargement, envoi sûr) plutôt que de le recopier : extraire un helper `modifierFichier(emplacement, transformation)` utilisable par les deux modules. Une seule connexion FTP par enregistrement (CSV et XML).

## Étape 3 : `src/main.ts` + `src/preload.cts` (IPC)

- `main.ts` : `correspondances:list` (`nom`) et `correspondances:save` (`nom`, `lignes`) ; valider les arguments (`nom` dans la liste blanche, `lignes` tableau de `{code, libelle}` en `String(...)`), même style que `producteurs:update`.
- `preload.cts` : `listCorrespondances(nom)`, `saveCorrespondances(nom, lignes)`.

## Étape 4 : `src/renderer/index.html` (UI)

À lire d'abord : sections `#conditionnements` (l. 146) et `#tailles` (l. 149), gestion des onglets, `afficherProducteurs()` (l. 254) pour réutiliser la normalisation de recherche.

1. Une fonction `initCorrespondances(section, nom)` appelée pour les deux onglets (un seul code, deux instances).
2. Barre au-dessus du tableau : champ de recherche (`type="search"`, code ou libellé) à gauche ; boutons **Ajouter une ligne** et **Enregistrer** à droite ; zone de message.
3. Tableau 2 colonnes **Code** – **Libellé**, cellules en `<input>` ; données tenues dans un tableau JS (source de vérité), le filtre ne fait que masquer des lignes (les lignes masquées restent enregistrées).
4. Recherche : `normalize("NFD")` sans diacritiques, minuscules, « contient », à chaque frappe ; ligne « Aucune correspondance trouvée » si vide.
5. Ajout : nouvelle ligne vide en tête de tableau, focus sur le code ; remise à zéro de la recherche.
6. Validation à la saisie : surligner les doublons / champs vides ; à l'enregistrement, refus avec message si invalide (rien n'est envoyé).
7. Enregistrer : IPC `saveCorrespondances` ; succès → message « Enregistré » ; erreur → message, saisie conservée. Chargement à l'ouverture de l'onglet (et bouton de rechargement facultatif). Avertir avant de quitter l'onglet avec des modifications non enregistrées : facultatif, non demandé.
8. `textContent` / `value` uniquement, jamais `innerHTML`.

## Étape 5 : vérification

- Check `node` sans Electron (`npm run build && node dist/correspondances.check.js`, sur le modèle de `producteurCsv.check.js`) : lecture avec/sans BOM, CRLF/LF, valeurs avec `;` / guillemets / accents / `&` `<` dans le libellé, doublon refusé, XML identique en structure, écriture idempotente (lire puis réécrire sans modification = fichier inchangé).
- Manuel : points 1 à 7 de la section « Vérification » de la spec, avec un dossier `liaisons/` local de test, puis en FTP. Cas d'échec : XML en lecture seule → CSV restauré ; FTP coupé → fichiers inchangés.
- Terminer par `npm run typecheck`.

## Étape 6 : docs

- `CLAUDE.md` : ajouter `correspondances.ts` dans « Structure prévue », mettre à jour la fonctionnalité 2/3 et retirer de « À définir » les points tranchés (chemin, structure CSV/XML).
- `spec/specification.md` : refléter l'évolution après validation.

## Points à trancher avant / pendant l'implémentation

- **Structure XML** : dicte le choix gabarit vs `fast-xml-parser` (étape 0).
- **Restauration du CSV** si le XML échoue : choix fait dans le plan (CLAUDE.md : « écrire les deux ou signaler l'erreur »). Alternative plus simple : signaler seulement ; à confirmer.
- **Comparaison des codes** : sensibilité à la casse (« 1A » vs « 1a »), à confirmer avec le métier.
- **FTP** : en clair comme pour `producteurs.csv` (FTPS à voir globalement).

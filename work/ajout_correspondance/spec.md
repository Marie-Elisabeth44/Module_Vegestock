# Correspondances : conditionnements et tailles

## Périmètre

- Onglet **Conditionnements** : tableau de 2 colonnes, **Code** – **Libellé**. Il établit la correspondance entre le code conditionnement du producteur (utilisé dans la définition de ses végétaux) et le code conditionnement utilisé dans le site Végéstock, afin d'harmoniser les végétaux proposés.
- Onglet **Tailles** : même fonctionnement, avec les fichiers `tailles.csv` et `tailles.xml`. Un seul module générique, paramétré par le nom du fichier (voir CLAUDE.md).
- L'accès aux fichiers se fait uniquement côté `main` ; le renderer passe par IPC (preload).

## Localisation des fichiers

- `conditionnements.csv` et `conditionnements.xml` (respectivement `tailles.csv` et `tailles.xml`) se trouvent dans le sous-dossier `liaisons/` (`import/liaisons`), au même endroit que `producteurs.csv`.
- Même mode d'accès que `producteurs.csv` (chemin local/réseau ou FTP, voir les paramètres).

## Lecture du fichier CSV

- Le fichier contient 2 colonnes : la 1re est le **code**, la 2e le **libellé**.
- La 1re ligne correspond aux **en-têtes**.
- Le tableau affiché est chargé avec le contenu de ce fichier (lignes de données, en-têtes exclus).

## Tableau

- Les informations du tableau sont **modifiables** (code et libellé).
- Il est possible d'**ajouter une ligne** pour un nouveau code avec son libellé.
- **Unicité du code** : un même code ne peut pas être présent plusieurs fois. Contrôle à la saisie et à l'enregistrement ; en cas de doublon, message d'erreur et rien n'est écrit. Code et libellé sont obligatoires.
- **Recherche** : en haut du tableau, un champ de recherche permet de trouver un code ou un libellé à partir d'une saisie. Filtrage dans le renderer, à chaque frappe, de type « contient », insensible à la casse et aux accents (comme la recherche des producteurs).

## Enregistrement

L'enregistrement se fait sous 2 formats, à l'endroit où `conditionnements.csv` a été lu :

1. **`conditionnements.csv`** : conserver la ligne d'en-tête et réécrire le contenu du tableau sous la même forme.
2. **`conditionnements.xml`** : conserver la même structure que le fichier `conditionnements.xml` présent au même endroit que `conditionnements.csv` (sous `import/liaisons`), en y enregistrant le contenu du tableau.

Cohérence (voir CLAUDE.md) : écriture sûre (fichier temporaire puis remplacement en local ; envoi puis contrôle en FTP). Si l'un des deux fichiers échoue, l'erreur est signalée et les fichiers ne sont pas laissés désynchronisés.

## Onglet Tailles

Même fonctionnement que l'onglet Conditionnements, mais avec les fichiers `tailles.csv` et `tailles.xml` sous `import/liaisons`.

## Vérification

1. Ouvrir l'onglet : le tableau reflète le contenu du CSV, sans la ligne d'en-têtes.
2. Modifier un libellé et enregistrer : CSV et XML sont à jour.
3. Ajouter une ligne et enregistrer : elle figure dans les deux fichiers.
4. Saisir un code déjà présent : refus, rien n'est écrit.
5. Rechercher par code, puis par libellé (casse et accents ignorés).
6. Mêmes contrôles sur l'onglet Tailles.
7. `npm run typecheck` sans erreur.

## À confirmer

- Nom du fichier de référence : `producteurs.csv` (le dépôt utilisait auparavant `producteurs.csv`).
- Chemin : `/liaisons/` ou `import/liaisons` (retenu : sous-dossier `liaisons/` du dossier de `producteurs.csv`).
- Structure exacte du XML, séparateur et encodage du CSV : à relever sur les fichiers réels.
- Suppression de lignes : non demandée, donc non prévue.

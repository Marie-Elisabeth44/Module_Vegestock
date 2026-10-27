# Évolutions à prévoir côté site Vegestock

L'appli n'accède pas directement à la base, et ouvrir MySQL aux postes clients serait risqué. Il faut donc ajouter côté site un `POST /api/producteur_modifier.php`, avec le même jeton Bearer que la lecture. Voici ce que la spec lui demande :

- **Requête SQL** : `UPDATE t_producteurs … WHERE id = ?` en requête préparée.
- **Identifiant** : `id` sert uniquement à cibler la ligne, il n'est jamais modifié.
- **Validation** : le site valide lui aussi les données, celle de l'appli ne suffit pas.
- **Codes de réponse** : 200, 400, 401 et 404.

## Localisation du producteur sur une carte

L'appli calcule la latitude et la longitude (API Adresse, à partir de `adresse`, `codepostal`, `ville`) et les envoie dans le JSON du POST. Le site doit les enregistrer :

- **Base** : ajouter deux colonnes nullables à `t_producteurs` :
  `ALTER TABLE t_producteurs ADD latitude DECIMAL(9,6) NULL, ADD longitude DECIMAL(9,6) NULL;`
- **Corps JSON** : `producteur_modifier.php` accepte deux champs supplémentaires, `latitude` et `longitude` (nombre ou `null`) :
  `{"id":1,…,"actif":1,"latitude":48.856614,"longitude":2.352222}`
- **Requête SQL** : ajouter `latitude = ?, longitude = ?` au `UPDATE t_producteurs … WHERE id = ?` préparé. `null` est une valeur valide (adresse non localisée) : elle remet les colonnes à `NULL`.
- **Validation** : chaque valeur est `null` ou numérique ; `latitude` entre -90 et 90, `longitude` entre -180 et 180, sinon `400 {"error":"…"}`. Un corps sans ces champs reste accepté (compatibilité), les colonnes ne sont alors pas modifiées.
- **Pas de géocodage côté site** : il est fait par l'appli. Le site stocke les valeurs reçues telles quelles.
- **Réponses** : le `200` renvoie aussi `latitude` et `longitude`. `producteurs.php` doit les renvoyer également, pour afficher la carte sur le site.

## Ajout d'un producteur

Deux web services supplémentaires, même jeton Bearer. Voir `work/ajout_producteur/spec.md`.

### `GET /api/producteur_id_disponible.php`

- `200` : `{"id": 123}`, l'id disponible : premier enregistrement dont le nom vaut « Non défini », sinon dernier id + 1.
- `401 {"error":"unauthorized"}` : jeton absent ou faux.
- Lecture seule : ne crée rien en base.

### `POST /api/producteur_ajouter.php`

- **Corps JSON** : mêmes champs que `producteur_modifier.php` :
  `{"id":12,"entreprise":"…","email":"…","logo":"…","adresse":"…","codepostal":"…","ville":"…","telephone":"…","fax":"…","actif":1,"latitude":48.856614,"longitude":2.352222}`
- **Requête SQL** (préparée) : si l'`id` existe avec le nom « Non défini », l'enregistrement est mis à jour ; si l'`id` n'existe pas (dernier id + 1), il est inséré.
- **Validation** : `entreprise` obligatoire, `email` obligatoire et valide, `actif` ∈ {0,1}, `latitude`/`longitude` `null` ou numériques dans les bornes (voir ci-dessus).
- **Réponses** : `200` + producteur créé (avec `latitude` et `longitude`) ; `400 {"error":"…"}` validation ; `401` jeton ; `409` id déjà utilisé par un producteur défini.
- **Pas de géocodage côté site** : coordonnées stockées telles que reçues. Les apostrophes sont déjà encodées par l'appli et ne sont pas ré-encodées.

Ces services sont à écrire dans le projet du site, pas dans ce dépôt.

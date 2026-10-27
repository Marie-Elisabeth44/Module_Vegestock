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

Ce service est à écrire dans le projet du site, pas dans ce dépôt.

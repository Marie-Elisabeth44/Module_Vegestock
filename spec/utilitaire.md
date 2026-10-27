# Utilisation : afficher la liste des producteurs

## Lancer l'application

Depuis `C:\Developpement\Module_Vegestock` :

```
npm start
```

Cette commande compile avec `tsc`, puis lance Electron. `node_modules` est déjà installé : `npm install` n'est pas nécessaire.

## Premier lancement : paramétrage

L'URL et le jeton ne sont pas encore enregistrés :

1. Ouvrir l'onglet **Paramètres**.
2. Saisir l'URL de l'API, par exemple `http://local.vegestock/api/producteurs.php`.
3. Saisir le jeton (celui de `config/api.php` côté site).
4. Cliquer sur **Enregistrer**. L'onglet **Producteurs** se recharge et affiche la liste.

Le jeton est chiffré (`safeStorage`) et n'est jamais renvoyé au renderer.

## En cas de problème

- **« Jeton refusé par le site (401) »** : le jeton est faux ou absent.
- **« Impossible de charger… fetch failed »** : `local.vegestock` n'est pas joignable depuis le poste. Vérifier que le site tourne et que le nom figure dans le fichier hosts. Tester avec :
  `curl -H "Authorization: Bearer <jeton>" http://local.vegestock/api/producteurs.php`
- **Champs manquants** : le JSON du site ne contient pas les 10 champs attendus (`id, entreprise, email, logo, adresse, codepostal, ville, telephone, fax, actif`).

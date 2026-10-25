# Comptabilité de l'association — Application Google Apps Script

Application web (Apps Script) pour consulter le bilan par compte, la synthèse par catégorie et le suivi du budget prévisionnel, ajouter des opérations dans la feuille `Opérations` et les pointer (rapprochement).
Spécifications : [specifications-app-comptabilite.md](specifications-app-comptabilite.md). Charte graphique : [charte-graphique.md](charte-graphique.md).

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `Code.gs` | **Bloc `CONFIG` (seule partie à modifier)**, `doGet`, fonctions `api*` |
| `Acces.gs` | Identification et contrôle des rôles (`CONFIG.UTILISATEURS`) |
| `Donnees.gs` | Lecture/écriture du Sheet, listes de choix, cache, Journal |
| `Bilan.gs` | Calculs purs : bilan par compte, synthèse, vue croisée, suivi budgétaire |
| `Operations.gs` | Validation d'une nouvelle opération |
| `Pointage.gs` | Écran de pointage d'un compte et contrôle d'une demande de pointage |
| `Utils.gs` | Outils (centimes, dates, réponses) et `@typedef` |
| `Tests.gs` | Tests des fonctions métier : exécuter `lancerTests` |
| `Index.html`, `Styles.html`, `App.html` | Interface (squelette, charte, JavaScript) |
| `appsscript.json` | Manifeste : fuseau, droits, déploiement Web App |

## Installation

1. Ouvrir le Google Sheet > **Extensions > Apps Script**.
2. Envoyer le code dans le projet Apps Script avec `clasp` (voir [Déploiement](#déploiement)) : `clasp push`.
   *Sans clasp* : créer chaque fichier `.gs`/`.html` de la racine avec le même nom dans l'éditeur (fichiers « Script » pour les `.gs`, « HTML » pour les `.html`) et y coller le contenu ; afficher le manifeste (Paramètres du projet > « Afficher le fichier manifeste appsscript.json ») et le remplacer par `appsscript.json`.
3. Vérifier le bloc `CONFIG` en tête de `Code.gs` (ID du fichier, noms des feuilles et des colonnes) et y déclarer les personnes autorisées dans `UTILISATEURS` (`email`, `nom`, `role` : `Lecteur` ou `Trésorier`, `actif`).
4. Dans le Sheet :
   vérifier que les colonnes `Compte`, `Moyen`, `Exercice` et `Catégorie Bilan Financier` ont une **validation de données de type liste** ou, si la feuille est un tableau, le type de colonne **Menu déroulant** (sinon un avertissement s'affiche pour le trésorier).
5. Partager le Sheet avec chaque personne : *Lecteur* pour le rôle `Lecteur`, *Éditeur* pour le rôle `Trésorier`.
6. Dans l'éditeur, exécuter `lancerTests` : le journal doit afficher `28/28 tests réussis.`
7. Créer le déploiement Web App : `clasp deploy -d "Première version"` (ou dans l'éditeur **Déployer > Nouveau déploiement > Application Web**). Les paramètres d'exécution viennent de `appsscript.json` : exécuter en tant que *l'utilisateur qui accède à l'application*, accès *tout utilisateur disposant d'un compte Google*.
8. Transmettre l'URL aux personnes autorisées (au premier accès, Google leur demande d'autoriser le script), puis dérouler les critères d'acceptation (§12 des spécifications).

La feuille `Journal` est créée automatiquement au premier ajout ou refus d'accès (désactivable via `CONFIG.APP.JOURNALISATION_ACTIVE`).

## Déploiement

Le code est synchronisé avec le projet Apps Script par [clasp](https://github.com/google/clasp) (testé avec la 3.4).

### Préparation (une seule fois par poste)

1. Installer clasp : `npm install -g @google/clasp`.
2. Activer l'API Apps Script pour son compte Google : <https://script.google.com/home/usersettings>.
3. Se connecter : `clasp login` (avec un compte éditeur du projet Apps Script).
4. Créer à la racine du dépôt un fichier `.clasp.json` (il est ignoré par git) :

   ```json
   { "scriptId": "<ID du projet>", "rootDir": "" }
   ```

   L'ID se trouve dans l'éditeur Apps Script > Paramètres du projet > « ID du script ».

`.claspignore` exclut les fichiers Markdown : seuls les `.gs`, `.html` et `appsscript.json` sont envoyés. `clasp status` liste les fichiers qui partiront.

### Publier une modification

1. `clasp push` : remplace le code du projet Apps Script par celui du dépôt (les fichiers supprimés localement le sont aussi dans le projet). Ne pas modifier le code dans l'éditeur en ligne, sinon ces changements seront écrasés (ou les récupérer d'abord avec `clasp pull`).
2. Tester avant de publier : exécuter `lancerTests` dans l'éditeur (`clasp open-script`), et ouvrir le déploiement de test (**Déployer > Tester les déploiements**), qui utilise toujours le dernier code poussé.
3. Retrouver l'ID du déploiement Web App : `clasp deployments` (ignorer la ligne `@HEAD`, qui est le déploiement de test).
4. Mettre à jour ce déploiement : `clasp redeploy <ID du déploiement> -d "description du changement"`. Une nouvelle version est créée et l'**URL de l'application ne change pas**.
   Équivalent dans l'éditeur : Déployer > Gérer les déploiements > Modifier (crayon) > Version : *Nouvelle version*.

Ne pas utiliser `clasp deploy` sans `-i` pour une mise à jour : il crée un **nouveau** déploiement avec une nouvelle URL.

## Points d'attention

- Une personne à qui le Sheet n'est pas partagé voit « Accès non autorisé » même si elle figure dans `CONFIG.UTILISATEURS` : la double barrière est voulue. Si **tout le monde** est refusé, vérifier `CONFIG.FICHIER.SPREADSHEET_ID` (le détail de l'erreur figure dans les journaux d'exécution).
- Ajouter, retirer ou suspendre une personne = modifier `CONFIG.UTILISATEURS` puis `clasp push` et **redéployer** une nouvelle version (voir [Publier une modification](#publier-une-modification)) : l'application publiée n'utilise que le code de la version déployée.
- Budget prévisionnel : les enveloppes se déclarent dans la feuille « Budget » du classeur, tableau à deux colonnes « Catégorie » et « Montant Prévu » (en euros, > 0). La colonne « Catégorie » est une liste déroulante à **choix multiples** (Données > Validation des données > Menu déroulant (à partir d'une plage) sur la liste des catégories, option « Autoriser plusieurs sélections ») : une enveloppe peut regrouper plusieurs catégories, son consommé est alors la somme de celles-ci. Une catégorie ne peut appartenir qu'à une seule enveloppe, et un nom de catégorie ne doit pas contenir de virgule (c'est le séparateur des choix multiples). Pas besoin de redéployer (cliquer « Actualiser » pour voir la modification tout de suite). La lecture s'arrête à la première ligne vide sous l'en-tête. Une catégorie inconnue ou déjà utilisée par une autre enveloppe, ou un montant invalide, est signalé par un bandeau dans l'onglet « Budgets ».
- Le fuseau horaire de `appsscript.json` doit rester identique à `CONFIG.APP.FUSEAU_HORAIRE`.
- Pointage (onglet « Pointage », trésorier) : un compte ou « Tous les comptes » ; « + Nouvelle opération » ouvre le formulaire d'ajout sans perdre les cases cochées ; rien n'est écrit tant que « Valider le pointage » n'est pas cliqué ; la validation coche toutes les cases `Rapproché` demandées, ou aucune si une opération a changé dans le Sheet entre-temps. Le dépointage se fait dans le Sheet.
- Les opérations sont ajoutées sur la première ligne vide après la dernière opération ; le format et la validation (cases à cocher) de la ligne précédente sont recopiés.

# Comptabilité de l'association — Application Google Apps Script

Application web (Apps Script) pour consulter le bilan par compte et la synthèse par catégorie, et ajouter des opérations dans la feuille `Opérations`.
Spécifications : [specifications-app-comptabilite.md](specifications-app-comptabilite.md). Charte graphique : [charte-graphique.md](charte-graphique.md).

## Contenu de `src/`

| Fichier | Rôle |
|---|---|
| `Code.gs` | **Bloc `CONFIG` (seule partie à modifier)**, `doGet`, fonctions `api*` |
| `Acces.gs` | Identification et contrôle des rôles (`CONFIG.UTILISATEURS`) |
| `Donnees.gs` | Lecture/écriture du Sheet, listes de choix, cache, Journal |
| `Bilan.gs` | Calculs purs : bilan par compte, synthèse, vue croisée |
| `Operations.gs` | Validation d'une nouvelle opération |
| `Utils.gs` | Outils (centimes, dates, réponses) et `@typedef` |
| `Tests.gs` | Tests des fonctions métier : exécuter `lancerTests` |
| `Index.html`, `Styles.html`, `App.html` | Interface (squelette, charte, JavaScript) |
| `appsscript.json` | Manifeste : fuseau, droits, déploiement Web App |

## Installation

1. Ouvrir le Google Sheet > **Extensions > Apps Script**.
2. Créer chaque fichier de `src/` avec le même nom (fichiers « Script » pour les `.gs`, « HTML » pour les `.html`) et y coller le contenu.
   Afficher le manifeste (Paramètres du projet > « Afficher le fichier manifeste appsscript.json ») et le remplacer par `src/appsscript.json`.
   *Alternative* : `clasp` avec un `.clasp.json` contenant `{"scriptId": "<ID du projet>", "rootDir": "src"}`, puis `clasp push`.
3. Vérifier le bloc `CONFIG` en tête de `Code.gs` (ID du fichier, noms des feuilles et des colonnes) et y déclarer les personnes autorisées dans `UTILISATEURS` (`email`, `nom`, `role` : `Lecteur` ou `Trésorier`, `actif`).
4. Dans le Sheet :
   vérifier que les colonnes `Compte`, `Moyen`, `Exercice` et `Catégorie Bilan Financier` ont une **validation de données de type liste** ou, si la feuille est un tableau, le type de colonne **Menu déroulant** (sinon un avertissement s'affiche pour le trésorier).
5. Partager le Sheet avec chaque personne : *Lecteur* pour le rôle `Lecteur`, *Éditeur* pour le rôle `Trésorier`.
6. Dans l'éditeur, exécuter `lancerTests` : le journal doit afficher `18/18 tests réussis.`
7. **Déployer > Nouveau déploiement > Application Web** — Exécuter en tant que : *l'utilisateur qui accède à l'application* ; Accès : *tout utilisateur disposant d'un compte Google*. Indiquer un numéro de version et une description.
8. Transmettre l'URL aux personnes autorisées (au premier accès, Google leur demande d'autoriser le script), puis dérouler les critères d'acceptation (§12 des spécifications).

La feuille `Journal` est créée automatiquement au premier ajout ou refus d'accès (désactivable via `CONFIG.APP.JOURNALISATION_ACTIVE`).

## Points d'attention

- Une personne à qui le Sheet n'est pas partagé voit « Accès non autorisé » même si elle figure dans `CONFIG.UTILISATEURS` : la double barrière est voulue. Si **tout le monde** est refusé, vérifier `CONFIG.FICHIER.SPREADSHEET_ID` (le détail de l'erreur figure dans les journaux d'exécution).
- Ajouter, retirer ou suspendre une personne = modifier `CONFIG.UTILISATEURS` puis **redéployer** une nouvelle version (Déployer > Gérer les déploiements > Modifier > Nouvelle version) : l'application publiée n'utilise que le code de la version déployée.
- Le fuseau horaire de `appsscript.json` doit rester identique à `CONFIG.APP.FUSEAU_HORAIRE`.
- Les opérations sont ajoutées sur la première ligne vide après la dernière opération ; le format et la validation (cases à cocher) de la ligne précédente sont recopiés.

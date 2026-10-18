# Spécifications détaillées — Application Google Apps Script « Comptabilité de l'association »

| | |
|---|---|
| **Version** | 1.2 — 17/10/2026 (configuration centralisée en en-tête, règles de qualité du code §14) |
| **Auteur** | Frédéric DiB (trésorier) |
| **Statut** | Validé, hors charte graphique à intégrer |
| **Fichier source** | Google Sheet `1brIcJM7JChCjKEZyi5Fe83pAwsRigaOeX2mKYDW2cZI`, feuille `Opérations` |
| **Charte graphique** | `charte-graphique.md` (document de référence, à appliquer intégralement) |

---

## 1. Objectif

Fournir aux membres habilités de l'association une application web (Google Apps Script, Web App) permettant :

1. de **consulter le bilan comptable** : soldes par compte, en distinguant opérations rapprochées et non rapprochées ;
2. de **consulter une synthèse par catégorie** (« Catégorie Bilan Financier ») pour chaque exercice ;
3. d'**ajouter une nouvelle opération** dans la feuille `Opérations`, avec contrôle de saisie ;
4. de **restreindre l'accès** aux seules personnes configurées, identifiées par leur compte Google.

Hors périmètre (v1) : modification / suppression d'opérations, rapprochement depuis l'application, import bancaire, export PDF.

---

## 2. Données sources

### 2.1 Feuille `Opérations`

La ligne 1 contient les en-têtes. Chaque ligne suivante est une opération.

| Colonne (en-tête exact) | Type | Obligatoire à la saisie | Règles |
|---|---|---|---|
| `Compte` | Liste de choix | Oui | Valeur parmi la liste définie (cf. §2.3) |
| `Quand` | Date | Oui | Date valide, format affiché `JJ/MM/AAAA` |
| `Qui` | Texte | Oui | 1 à 100 caractères, espaces de début/fin supprimés |
| `Quoi` | Texte | Oui | 1 à 200 caractères, espaces de début/fin supprimés |
| `Moyen` | Liste de choix | Oui | Valeur parmi la liste définie |
| `Combien` | Montant (€) | Oui | Nombre décimal, 2 décimales max, ≠ 0. **Positif = recette, négatif = dépense** |
| `Exercice` | Liste de choix | Oui | Valeur parmi la liste définie |
| `Rapproché` | Booléen (case à cocher) | Oui | `VRAI` / `FAUX` ; toujours `FAUX` à la saisie (non proposé dans le formulaire) |
| `Catégorie Bilan Financier` | Liste de choix (liste fermée) | Oui | Valeur parmi la liste définie (cf. §2.3) |
| `Commentaire` | Texte | **Non** | 0 à 500 caractères |

### 2.2 Repérage des colonnes

- Les colonnes sont repérées **par leur en-tête** (lecture de la ligne 1), jamais par leur position. Un réordonnancement des colonnes dans le Sheet ne doit pas casser l'application.
- La comparaison des en-têtes ignore la casse et les espaces superflus.
- Si un en-tête attendu est absent, l'application affiche une erreur explicite (« Colonne "Exercice" introuvable dans la feuille Opérations ») et bloque l'ajout d'opération.

### 2.3 Listes de choix (Compte, Moyen, Exercice, Catégorie Bilan Financier)

Les valeurs autorisées sont **paramétrées dans le Sheet, par la validation de données de chaque colonne**. L'application ne maintient aucune liste en dur.

1. **Source de référence** : lecture de la règle de validation de la colonne (`Range.getDataValidation()`, sur la première cellule de données), de type « liste d'éléments » (`VALUE_IN_LIST`) ou « liste à partir d'une plage » (`VALUE_IN_RANGE`) — on lit alors la plage référencée. Si la feuille est un **tableau** Google Sheets, le menu déroulant est le type de la colonne, invisible pour `getDataValidation()` : il est lu via le service avancé Sheets (`Spreadsheets.get`, `tables[].columnProperties[].dataValidationRule`).
2. **Ordre** : les valeurs sont proposées **dans l'ordre défini dans la validation** (pas de tri par l'application).
3. **Pas de lecture des données** : les opérations ne sont jamais parcourues pour en déduire les valeurs ; seuls la ligne d'en-tête et la règle de validation sont lus.
4. **Validation absente ou illisible** : la liste est vide (aucune saisie possible pour ce champ) et un avertissement est affiché au trésorier (« La colonne X n'a pas de liste de choix paramétrée »).

**Exercice** : il n'existe pas de règle de calcul à partir de la date ; l'exercice est toujours choisi dans la liste. La **valeur par défaut** (saisie et synthèse) est **la dernière valeur de la liste de choix**.

Le serveur revérifie systématiquement que la valeur reçue appartient à la liste au moment de l'enregistrement.

### 2.4 Personnes autorisées (`CONFIG.UTILISATEURS`)

La liste des personnes autorisées est déclarée dans le bloc `CONFIG` de `Code.gs`, une entrée par personne :

| Champ | Type | Description |
|---|---|---|
| `email` | Texte | Adresse Google de la personne autorisée (comparaison insensible à la casse) |
| `nom` | Texte | Nom affiché dans l'application |
| `role` | `Lecteur` ou `Trésorier` | `Lecteur` : consultation seule ; `Trésorier` : consultation + ajout d'opérations |
| `actif` | Booléen | Permet de suspendre un accès sans supprimer l'entrée |

- Seules les personnes pouvant modifier le projet Apps Script peuvent changer la liste ; toute modification nécessite de redéployer une nouvelle version.
- `verifierConfiguration_()` signale une adresse mal formée ou en double et un rôle inconnu.

---|---|---|
| `Email` | Texte | Adresse Google de la personne autorisée (comparaison insensible à la casse) |
| `Nom` | Texte | Nom affiché dans l'application |
| `Rôle` | Liste : `Lecteur`, `Trésorier` | `Lecteur` : consultation seule ; `Trésorier` : consultation + ajout d'opérations |
| `Actif` | Booléen | Permet de désactiver un accès sans supprimer la ligne |

- La feuille est protégée (Données > Feuilles et plages protégées) : seul le trésorier peut la modifier.
- Alternative possible : stocker la liste dans les *Script Properties*. Retenu : feuille dédiée, plus simple à maintenir pour un non-développeur.

---

## 3. Architecture technique

### 3.1 Vue d'ensemble

```
Navigateur (HTML/CSS/JS, HtmlService)
      │  google.script.run (appels asynchrones)
      ▼
Apps Script côté serveur (Code.gs)
      │  SpreadsheetApp.openById(...)
      ▼
Google Sheet : Opérations
```

- **Type de projet** : script autonome (*standalone*) ou lié au Sheet. Recommandé : **lié au Sheet** (Extensions > Apps Script), pour que le code suive le fichier.
- **Déploiement** : Web App (`doGet`).
- **Front** : une page unique (SPA légère) servie par `HtmlService.createTemplateFromFile('Index')`, sans framework externe obligatoire (vanilla JS). Pas de dépendance CDN indispensable.

### 3.2 Paramètres de déploiement et identification

| Paramètre | Valeur | Justification |
|---|---|---|
| Exécuter en tant que | **L'utilisateur qui accède à l'application** | Avec des comptes Gmail personnels, `Session.getActiveUser().getEmail()` ne renvoie l'adresse de façon fiable que dans ce mode |
| Qui a accès | **Tout utilisateur disposant d'un compte Google** | La restriction fine est faite par l'application (liste blanche §2.4) |

Conséquences :

- Chaque personne autorisée doit avoir **un accès au Google Sheet** : *Lecteur* pour le rôle `Lecteur`, *Éditeur* pour le rôle `Trésorier` (sinon l'écriture échoue).
- Au premier accès, Google demande à l'utilisateur d'autoriser le script (écran de consentement OAuth standard).
- Le contrôle applicatif (liste blanche) s'ajoute au contrôle Google (partage du fichier) : **double barrière**.

### 3.3 Organisation des fichiers du projet

| Fichier | Couche | Rôle |
|---|---|---|
| `Code.gs` | Configuration + points d'entrée | **Bloc de configuration en en-tête** (§3.4), puis `doGet`, `include` et fonctions exposées au client (`api*`) |
| `Acces.gs` | Sécurité | Identification de l'utilisateur (`CONFIG.UTILISATEURS`), contrôle des rôles |
| `Donnees.gs` | Accès aux données | Lecture/écriture du Sheet, mapping des en-têtes, listes de choix, cache |
| `Bilan.gs` | Métier | Calculs purs : soldes par compte, synthèse par catégorie (aucun appel à `SpreadsheetApp`) |
| `Operations.gs` | Métier | Validation et normalisation d'une nouvelle opération |
| `Utils.gs` | Outils | Conversion centimes/euros, dates, chaînes, construction des réponses `{ ok, ... }` |
| `Index.html` | Vue | Squelette de la page |
| `Styles.html` | Vue | CSS ; **variables de la charte en tête de fichier** (§8.1) |
| `App.html` | Vue | JavaScript client ; **constantes d'interface en tête de fichier** (§3.5) |

Inclusion via `<?!= include('Styles') ?>` et `<?!= include('App') ?>`.

Dépendances autorisées (sens unique) : `Code.gs` → `Acces.gs` / `Operations.gs` / `Bilan.gs` → `Donnees.gs` → `Utils.gs`. Les fonctions métier reçoivent des données déjà lues et renvoient des résultats : elles sont testables sans le Sheet.

### 3.4 Configuration centralisée (en-tête de `Code.gs`)

**Exigence** : **toute** valeur paramétrable de l'application est déclarée **une seule fois**, dans un bloc unique `CONFIG` placé **en tout début du fichier `Code.gs`** (premier fichier du projet), avant toute fonction. Objectif : un trésorier non développeur peut adapter l'application en modifiant uniquement ce bloc, sans lire le reste du code.

Règles :

- **Aucune valeur en dur ailleurs** dans le code serveur : ID du fichier, noms de feuilles, en-têtes de colonnes, noms de rôles, limites, délais, formats, libellés et messages sont lus depuis `CONFIG`.
- Le bloc est **commenté ligne à ligne en français** (à quoi sert le paramètre, valeurs possibles, impact d'une modification).
- Il est organisé en **sections thématiques** clairement délimitées (voir ci-dessous), dans l'ordre de fréquence de modification : ce qui change le plus souvent en premier.
- L'objet est **figé** (`Object.freeze` récursif) pour éviter toute modification accidentelle à l'exécution.
- Une fonction `verifierConfiguration_()` est appelée au démarrage (`doGet`) : elle contrôle la présence des feuilles et des colonnes déclarées et renvoie un message lisible si un paramètre est incohérent.
- Les listes de valeurs métier (Compte, Moyen, Exercice, Catégorie) **ne figurent pas** dans `CONFIG` : elles restent paramétrées dans le Sheet (§2.3). La liste des utilisateurs est dans `CONFIG.UTILISATEURS` (§2.4).

Contenu attendu :

```javascript
/* =============================================================================
 *  CONFIGURATION DE L'APPLICATION
 *  Seule partie du code à modifier pour adapter l'application.
 *  Ne rien modifier en dessous de ce bloc sans connaissance d'Apps Script.
 * ========================================================================== */
const CONFIG = deepFreeze_({

  /* --- 1. Application --------------------------------------------------- */
  APP: {
    TITRE: 'Comptabilité de l\'association',   // Titre affiché dans l'en-tête et l'onglet du navigateur
    FUSEAU_HORAIRE: 'Europe/Paris',             // Fuseau utilisé pour les dates
    LOCALE: 'fr-FR',                            // Format des nombres et des dates
    DEVISE: 'EUR',                              // Devise des montants
    JOURNALISATION_ACTIVE: true                 // true = trace les ajouts et refus dans la feuille Journal
  },

  /* --- 2. Fichier et feuilles ------------------------------------------- */
  FICHIER: {
    SPREADSHEET_ID: '1brIcJM7JChCjKEZyi5Fe83pAwsRigaOeX2mKYDW2cZI', // ID du Google Sheet
    FEUILLE_OPERATIONS: 'Opérations',          // Feuille des opérations
    FEUILLE_JOURNAL: 'Journal',                // Feuille de journalisation
    LIGNE_EN_TETE: 1                           // Numéro de la ligne contenant les en-têtes
  },

  /* --- 3. Colonnes de la feuille Opérations (en-têtes exacts) ----------- */
  COLONNES: {
    COMPTE: 'Compte',
    QUAND: 'Quand',
    QUI: 'Qui',
    QUOI: 'Quoi',
    MOYEN: 'Moyen',
    COMBIEN: 'Combien',
    EXERCICE: 'Exercice',
    RAPPROCHE: 'Rapproché',
    CATEGORIE: 'Catégorie Bilan Financier',
    COMMENTAIRE: 'Commentaire'
  },

  /* --- 4. Personnes autorisées ------------------------------------------ */
  UTILISATEURS: [
    { email: 'tresorier@exemple.fr', nom: 'Trésorier', role: 'Trésorier', actif: true },
    { email: 'membre@exemple.fr', nom: 'Membre du bureau', role: 'Lecteur', actif: true }
  ],

  /* --- 5. Rôles --------------------------------------------------------- */
  ROLES: {
    LECTEUR: 'Lecteur',        // Consultation seule
    TRESORIER: 'Trésorier'     // Consultation + ajout d'opérations
  },

  /* --- 6. Règles de saisie --------------------------------------------- */
  SAISIE: {
    CHAMPS_FACULTATIFS: ['COMMENTAIRE'],   // Clés de COLONNES non obligatoires
    LONGUEUR_MAX: { QUI: 100, QUOI: 200, COMMENTAIRE: 500 },
    DECIMALES_MONTANT: 2,
    DATE_MIN: '2000-01-01',                // Date la plus ancienne acceptée
    DATE_MAX_JOURS_FUTUR: 365,             // Nombre de jours acceptés après aujourd'hui
    CHAMPS_CONSERVES_APRES_AJOUT: ['COMPTE', 'MOYEN', 'EXERCICE', 'QUAND']
  },

  /* --- 7. Affichage ----------------------------------------------------- */
  AFFICHAGE: {
    LIBELLE_SANS_CATEGORIE: 'Non catégorisé',
    LIBELLE_TOUS_EXERCICES: 'Tous',
    FORMAT_DATE: 'dd/MM/yyyy',
    ONGLET_PAR_DEFAUT: 'BILAN'             // 'BILAN', 'SYNTHESE' ou 'AJOUT'
  },

  /* --- 8. Technique ----------------------------------------------------- */
  TECHNIQUE: {
    CACHE_DUREE_SECONDES: 600,             // Durée de mise en cache des données et calculs
    VERROU_DELAI_MS: 10000                 // Attente maximale du verrou lors d'un ajout
  },

  /* --- 9. Messages affichés à l'utilisateur ----------------------------- */
  MESSAGES: {
    NON_IDENTIFIE: 'Impossible de vous identifier. Connectez-vous avec votre compte Google.',
    NON_AUTORISE: 'Accès non autorisé pour {email}. Contactez le trésorier.',
    DROITS_INSUFFISANTS: 'Vous n\'avez pas les droits pour effectuer cette action.',
    CHAMP_OBLIGATOIRE: 'Ce champ est obligatoire.',
    VALEUR_HORS_LISTE: 'Valeur non autorisée.',
    FICHIER_OCCUPE: 'Le fichier est occupé, réessayez dans quelques secondes.',
    OPERATION_ENREGISTREE: 'Opération enregistrée (ligne {ligne}).',
    COLONNE_INTROUVABLE: 'Colonne "{colonne}" introuvable dans la feuille {feuille}.',
    ERREUR_INATTENDUE: 'Une erreur est survenue. Réessayez ou contactez le trésorier.'
  }
});
/* ========================= FIN DE LA CONFIGURATION ======================= */
```

Note technique : la fonction `deepFreeze_` est déclarée **dans `Code.gs`, juste après le bloc** (et non dans `Utils.gs`). En effet, Apps Script exécute le code global des fichiers dans leur ordre, et une fonction déclarée dans un autre fichier peut ne pas être encore disponible au moment où `CONFIG` est construit.

### 3.5 Configuration côté client et côté style

Même principe pour les fichiers de la vue :

- **`App.html`** : un bloc `const UI_CONFIG = { ... }` en tête de script pour les seuls réglages purement visuels (durée d'affichage des notifications, nombre de lignes avant défilement, etc.). Les libellés, formats et valeurs par défaut sont **transmis par le serveur** depuis `CONFIG` (via `apiGetContexte()`), pour qu'il n'y ait qu'une seule source de vérité.
- **`Styles.html`** : un bloc `:root { --... }` en tête de fichier, contenant toutes les couleurs, polices et espacements de la charte (§8.1). Aucune couleur en dur dans le reste de la feuille de style.

---

## 4. Contrôle d'accès

### 4.1 Règle

À **chaque** appel (affichage de la page et chaque fonction serveur appelée par le client) :

1. Récupérer `email = Session.getActiveUser().getEmail()`.
2. Si `email` est vide → accès refusé (« Impossible de vous identifier. Connectez-vous avec votre compte Google. »).
3. Chercher `email` dans `CONFIG.UTILISATEURS` avec `actif: true`, puis vérifier que la personne peut ouvrir le Sheet.
4. Absent (ou Sheet non partagé) → page « Accès non autorisé » affichant l'adresse détectée et invitant à contacter le trésorier. Aucune donnée comptable n'est transmise.
5. Présent → l'utilisateur est identifié ; son `Nom` et son `Rôle` sont affichés dans l'en-tête de l'application.

### 4.2 Contrôle des droits par fonction

| Fonction serveur | Lecteur | Trésorier |
|---|---|---|
| `getContexteUtilisateur()` | ✅ | ✅ |
| `getBilanParCompte(filtres)` | ✅ | ✅ |
| `getSyntheseParCategorie(exercice)` | ✅ | ✅ |
| `getListesDeChoix()` | ✅ | ✅ |
| `ajouterOperation(operation)` | ❌ (erreur « Droits insuffisants ») | ✅ |

Le contrôle est fait **côté serveur** ; masquer le bouton côté client n'est qu'un confort d'interface.

### 4.3 Journalisation (optionnelle, recommandée)

Feuille `Journal` : horodatage, email, action (`CONSULTATION`, `AJOUT_OPERATION`, `ACCES_REFUSE`), détail. Écriture uniquement pour les ajouts et les refus (pas pour chaque consultation, pour limiter le volume).

---

## 5. Fonctionnalité 1 — Bilan par compte

### 5.1 Description

Tableau donnant, pour chaque compte, la somme des montants (`Combien`) répartie entre lignes rapprochées et non rapprochées.

### 5.2 Filtres

| Filtre | Valeurs | Défaut |
|---|---|---|
| Exercice | « Tous » + liste des exercices | **Tous** (le solde d'un compte bancaire est cumulatif) |
| Date de fin (« Solde au ») | Date | Aujourd'hui |

### 5.3 Colonnes du tableau

| Colonne | Calcul |
|---|---|
| Compte | Nom du compte |
| Rapproché | Σ `Combien` où `Rapproché = VRAI` |
| Non rapproché | Σ `Combien` où `Rapproché = FAUX` |
| Solde total | Rapproché + Non rapproché |
| Nb opérations non rapprochées | Nombre de lignes où `Rapproché = FAUX` |

- Une ligne **Total** en pied de tableau additionne tous les comptes.
- Les comptes de la liste de choix sans aucune opération apparaissent avec des montants à 0,00 €.
- Montants négatifs affichés avec la couleur « négatif » de la charte (ou rouge par défaut).

### 5.4 Détail des opérations non rapprochées

Un clic sur une ligne de compte (ou sur le nombre d'opérations non rapprochées) ouvre la liste des opérations non rapprochées de ce compte : Quand, Qui, Quoi, Moyen, Combien, Commentaire. Tri par date croissante. Lecture seule.

### 5.5 Règles de calcul

- Les lignes entièrement vides sont ignorées.
- Une ligne avec un `Combien` non numérique est ignorée **et signalée** dans un bandeau d'avertissement (« 2 lignes ignorées : montant invalide, lignes 45, 112 »).
- `Rapproché` vide est traité comme `FAUX`.
- Calculs effectués en **centimes entiers** pour éviter les erreurs d'arrondi des flottants, puis reconvertis en euros pour l'affichage.
- Format d'affichage : `1 234,56 €` (`fr-FR`, `Intl.NumberFormat`).

---

## 6. Fonctionnalité 2 — Synthèse par catégorie et par exercice

### 6.1 Description

Pour un exercice sélectionné, tableau des totaux par `Catégorie Bilan Financier`, séparant recettes et dépenses.

### 6.2 Écran

- **Sélecteur d'exercice** : liste des exercices (ordre de la liste de choix), défaut = **dernière valeur de la liste**.
- **Virements internes** entre comptes de l'association : aucun traitement particulier, ils sont comptés comme les autres opérations dans leur catégorie.
- **Option** « Comparer avec l'exercice précédent » (affiche une colonne N-1 et l'écart).
- **Tableau** :

| Colonne | Calcul |
|---|---|
| Catégorie | Valeur de `Catégorie Bilan Financier` (« Non catégorisé » si vide sur une ligne historique) ; les catégories de la liste sans opération sur l'exercice apparaissent à 0,00 € |
| Recettes | Σ des `Combien` > 0 |
| Dépenses | Σ des `Combien` < 0 (affichées en valeur absolue) |
| Solde | Recettes − Dépenses |
| Nb opérations | Nombre de lignes |
| % du total | Part de la catégorie dans le total des recettes (pour une catégorie de recettes) ou des dépenses |

- Tri par défaut : catégories par solde décroissant ; tri modifiable par clic sur l'en-tête.
- **Pied de tableau** : Total recettes, Total dépenses, **Résultat de l'exercice** (excédent ou déficit, mis en évidence).
- **Indicateur** : part des opérations de l'exercice non encore rapprochées (ex. « 12 opérations non rapprochées, 345,00 € »).
- **Graphique** (optionnel v1) : barres horizontales recettes/dépenses par catégorie, couleurs de la charte.

### 6.3 Vue « tous exercices »

Tableau croisé : catégories en lignes, exercices en colonnes, soldes dans les cellules, ligne de total par exercice. Permet de suivre l'évolution d'une catégorie dans le temps.

### 6.4 Regroupement par année civile

- **Sélecteur** « Regrouper par » : **Exercice** (défaut) ou **Année civile**.
- En année civile, la période d'une opération est l'année de sa date (`Quand`), indépendamment de son `Exercice`. La liste des années est déduite des opérations datées (ordre croissant), défaut = **année la plus récente**.
- La synthèse (§6.2), la comparaison avec l'année précédente et la vue « Tous » (§6.3, années en colonnes) fonctionnent de la même manière.
- Les opérations sans date valide n'apparaissent dans aucune année ; dans la vue « Tous », elles sont regroupées dans une colonne « — » pour que les totaux restent complets.

### 6.5 Suivi du budget prévisionnel

- Onglet **« Budgets »** (tous rôles) : des enveloppes de dépenses sont définies pour certaines catégories dans `CONFIG.BUDGET.ENVELOPPES` (`{ categorie, montant }`), pour l'exercice `CONFIG.BUDGET.EXERCICE` (vide = **dernier exercice de la liste**).
- Pour chaque enveloppe : budget, **consommé** = dépenses − recettes (remboursements) de la catégorie sur l'exercice, **reste** (négatif = dépassement), part consommée (%) en jauge, nombre d'opérations.
- Statut : « Dans le budget », « Bientôt atteint » (part ≥ `CONFIG.BUDGET.SEUIL_ALERTE_POURCENT`) ou « Dépassé ».
- Tuiles de total : budget, consommé, reste.
- Une catégorie d'enveloppe absente de la liste de choix est signalée par un avertissement.
- Interrupteur **« Reporter les dépassements sur les autres enveloppes »** (désactivé par défaut) : le dépassement des enveloppes dépassées est réparti sur les enveloppes non dépassées **au prorata de leur budget**. Une enveloppe n'absorbe jamais plus que son reste ; l'excédent est réparti à nouveau sur celles qui ont encore de la marge. La part reçue apparaît **hachurée** dans la jauge ; une enveloppe dont le dépassement est entièrement reporté affiche « Dépassement reporté ». Si les marges ne suffisent pas, un bandeau indique le montant non couvert, qui reste sur les enveloppes dépassées. Les tuiles de total ne changent pas.

---

## 7. Fonctionnalité 3 — Ajout d'une opération

Réservée au rôle `Trésorier`.

### 7.1 Formulaire

| Champ | Contrôle d'interface | Valeur par défaut |
|---|---|---|
| Compte | Liste déroulante (§2.3) | Vide (« — Choisir — ») |
| Quand | Sélecteur de date (`<input type="date">`) | Date du jour |
| Qui | Champ texte libre (sans suggestions) | Vide |
| Quoi | Champ texte | Vide |
| Moyen | Liste déroulante | Vide |
| Combien | Champ numérique signé : **positif (ou sans signe) = recette, négatif = dépense** | Vide |
| Exercice | Liste déroulante | Dernière valeur de la liste de choix |
| Catégorie Bilan Financier | Liste déroulante (§2.3) | Vide (« — Choisir — ») |
| Commentaire | Zone de texte | Vide |

Les champs obligatoires sont marqués d'un astérisque ; le Commentaire est explicitement libellé « (facultatif) ».

### 7.2 Validation

**Côté client** (avant envoi) : tous les champs sauf Commentaire non vides ; montant > 0 avec 2 décimales max (virgule ou point acceptés) ; date valide. Messages d'erreur sous chaque champ fautif ; le bouton « Enregistrer » reste actif mais l'envoi est bloqué tant qu'il reste des erreurs.

**Côté serveur** (`ajouterOperation`), revalidation complète :

1. Droits (rôle `Trésorier`).
2. Présence de tous les champs obligatoires (après `trim`).
3. Compte, Moyen, Exercice, Catégorie Bilan Financier ∈ listes de choix courantes.
4. Date valide et comprise dans une plage raisonnable (ex. 2000 → aujourd'hui + 1 an).
5. Montant numérique, ≠ 0, arrondi à 2 décimales.
6. Longueurs maximales respectées.
7. Neutralisation des injections de formule : un texte commençant par `=`, `+`, `-` ou `@` est préfixé d'une apostrophe.

En cas d'erreur, le serveur renvoie `{ ok: false, erreurs: { champ: message } }` et rien n'est écrit.

### 7.3 Enregistrement

- Verrou `LockService.getDocumentLock().waitLock(10000)` pour éviter les écritures concurrentes.
- Construction de la ligne **dans l'ordre des colonnes lues dans l'en-tête** (§2.2) ; les colonnes inconnues éventuelles restent vides.
- Ajout en fin de tableau (`appendRow`, ou première ligne vide après la dernière ligne de données).
- `Quand` écrit comme objet `Date` (pas de texte) ; `Rapproché` écrit comme booléen ; `Combien` comme nombre.
- Recopie du format de la ligne précédente (format monétaire, case à cocher) si nécessaire.
- Libération du verrou dans un bloc `finally`.
- Invalidation du cache (§9).
- Réponse : `{ ok: true, ligne: <numéro de ligne> }`.

### 7.4 Retour utilisateur

- Succès : notification « Opération enregistrée (ligne 248) », formulaire réinitialisé en conservant Compte, Moyen, Exercice et Date (saisies en série facilitées), bilans rafraîchis.
- Échec : message d'erreur explicite, données du formulaire conservées.
- Protection contre le double clic : bouton désactivé pendant l'envoi, avec indicateur de chargement.

---

## 8. Interface utilisateur

### 8.1 Charte graphique

L'interface applique **intégralement** le document `charte-graphique.md` : couleurs, typographies, logo, espacements, style des boutons, des tableaux et des formulaires.

Mise en œuvre : les valeurs de la charte sont déclarées une seule fois en variables CSS dans `Styles.html` :

```css
:root {
  --couleur-primaire: /* charte */;
  --couleur-secondaire: /* charte */;
  --couleur-fond: /* charte */;
  --couleur-texte: /* charte */;
  --couleur-positif: /* charte */;
  --couleur-negatif: /* charte */;
  --police-titres: /* charte */;
  --police-texte: /* charte */;
  --rayon-bordure: /* charte */;
}
```

Aucune couleur ni police n'est codée en dur ailleurs. Si la charte utilise une police Google Fonts, elle est chargée via `<link>` (autorisé dans HtmlService).

### 8.2 Structure de la page

```
┌──────────────────────────────────────────────────────────┐
│ [Logo] Comptabilité <Association>   Frédéric (Trésorier) │
├──────────────────────────────────────────────────────────┤
│ [ Bilan par compte ] [ Synthèse par catégorie ] [ Budgets ] [ + Ajouter ] │
├──────────────────────────────────────────────────────────┤
│  Filtres                                                 │
│  Tableau / formulaire                                    │
│                                                          │
│  Dernière mise à jour : 17/10/2026 14:32  [↻ Actualiser]  │
└──────────────────────────────────────────────────────────┘
```

- Navigation par onglets ; l'onglet « Ajouter » n'est visible que pour le rôle `Trésorier`.
- Bouton « Actualiser » qui force la relecture du Sheet (contourne le cache).
- Lien « Ouvrir le Google Sheet » (pour le trésorier).

### 8.3 Responsive et accessibilité

- Utilisable sur mobile (≥ 360 px) : tableaux avec défilement horizontal interne, formulaire sur une colonne.
- Libellés `<label>` associés à chaque champ, contraste conforme WCAG AA, navigation au clavier possible.
- Langue `fr`, formats français (dates `JJ/MM/AAAA`, montants `1 234,56 €`).

---

## 9. Performances

- Lecture de la feuille en **un seul appel** `getDataRange().getValues()` ; aucun accès cellule par cellule.
- Calculs côté serveur ; seuls les agrégats (et les détails demandés) sont envoyés au client.
- Cache `CacheService.getScriptCache()` pendant 600 s : données lues du Sheet (opérations, listes de choix, découpées en morceaux de 25 000 caractères) et résultats agrégés (clé incluant les filtres) ; invalidé à chaque ajout d'opération et par le bouton « Actualiser ».
- Au démarrage, le bilan est demandé en parallèle du contexte.
- Objectif : affichage du bilan en < 3 s pour 5 000 lignes.

---

## 10. Gestion des erreurs

| Situation | Comportement |
|---|---|
| Utilisateur non identifié / non autorisé | Page « Accès non autorisé », aucune donnée transmise |
| Feuille `Opérations` absente | Message d'erreur explicite, nom de la feuille attendue |
| En-tête manquant | Message explicite ; ajout d'opération désactivé |
| Ligne de données invalide | Ligne ignorée dans les calculs + bandeau d'avertissement listant les numéros de lignes |
| Verrou non obtenu (10 s) | « Le fichier est occupé, réessayez dans quelques secondes » |
| Erreur inattendue | Message générique côté client ; détail dans `console.error` (journal d'exécution Apps Script) |

Toutes les fonctions serveur renvoient un objet `{ ok, data | erreurs | message }` ; aucune exception brute n'est propagée au client.

---

## 11. Décisions validées (17/10/2026)

| # | Sujet | Décision |
|---|---|---|
| 1 | Signe de `Combien` | Positif = recette, négatif = dépense |
| 2 | Exercice | Liste de choix paramétrée dans la validation de la colonne ; pas de déduction depuis la date ; défaut = dernière valeur de la liste |
| 3 | Catégorie Bilan Financier | Liste fermée, paramétrée comme les autres listes de choix |
| 4 | Rôles | Deux rôles : `Lecteur` (consultation) et `Trésorier` (consultation + ajout) |
| 5 | Partage du Sheet | Accepté : chaque personne autorisée a aussi accès au fichier ; déploiement « exécuter en tant que l'utilisateur qui accède » |
| 6 | Virements internes | Comptés normalement, sans traitement particulier |

**Reste à fournir** : le contenu de `charte-graphique.md`, pour renseigner les variables CSS du §8.1.

**Prérequis côté Sheet** : la colonne `Catégorie Bilan Financier` doit être dotée d'une validation de données « liste » (comme Compte, Moyen et Exercice).

---

## 12. Critères d'acceptation

| # | Scénario | Résultat attendu |
|---|---|---|
| A1 | Une personne absente de `CONFIG.UTILISATEURS` ouvre l'URL | Page « Accès non autorisé » avec son adresse ; aucune donnée visible |
| A2 | Une personne présente mais `Actif = FAUX` | Même résultat que A1 |
| A3 | Un `Lecteur` ouvre l'application | Il voit les bilans, pas l'onglet « Ajouter » ; un appel forcé à `ajouterOperation` est refusé |
| B1 | Bilan par compte, filtre « Tous » | Pour chaque compte : Rapproché + Non rapproché = Solde total ; totaux identiques à un `SOMME.SI.ENS` fait dans le Sheet |
| B2 | Filtre sur un exercice | Seules les opérations de cet exercice sont prises en compte |
| B3 | Clic sur un compte | Liste exacte des opérations non rapprochées du compte |
| C1 | Synthèse d'un exercice | Total recettes − Total dépenses = Résultat ; somme des catégories = total de l'exercice |
| C2 | Opération sans catégorie | Comptée dans « Non catégorisé » |
| D1 | Ajout avec tous les champs valides, sans commentaire | Nouvelle ligne correcte en fin de feuille (types Date / nombre / booléen respectés) ; bilans mis à jour |
| D2 | Ajout avec un champ obligatoire vide | Erreur sur le champ ; aucune écriture |
| D3 | Valeur hors liste envoyée au serveur (requête modifiée) | Refus serveur ; aucune écriture |
| D3b | Formulaire ouvert | Exercice pré-sélectionné = dernière valeur de la liste ; Catégorie proposée en liste déroulante |
| D4 | Saisie « =HYPERLINK(...) » dans Quoi | Enregistrée comme texte, non interprétée comme formule |
| D5 | Deux ajouts simultanés | Deux lignes distinctes, aucune écrasée |
| E1 | Colonnes du Sheet réordonnées | Application fonctionnelle sans modification du code |
| E1b | Feuille `Opérations` renommée, nouveau nom reporté uniquement dans `CONFIG` | Application fonctionnelle ; aucune autre ligne de code modifiée |
| E1c | En-tête déclaré dans `CONFIG` absent du Sheet | Message clair de `verifierConfiguration_()` à l'ouverture |
| E2 | Affichage sur smartphone | Navigation et saisie utilisables |
| E3 | Rendu visuel | Conforme à `charte-graphique.md` |

---

## 13. Procédure d'installation (résumé)

1. Ouvrir le Google Sheet > Extensions > Apps Script.
2. Créer les fichiers listés au §3.3 et coller le code ; vérifier/adapter le bloc `CONFIG` en tête de `Code.gs`.
3. Déclarer les personnes autorisées dans `CONFIG.UTILISATEURS`.
4. Partager le Sheet avec ces personnes (Lecteur ou Éditeur selon le rôle).
5. Déployer > Nouveau déploiement > Application Web — Exécuter en tant que : *l'utilisateur qui accède* ; Accès : *tout utilisateur disposant d'un compte Google*.
6. Transmettre l'URL de l'application aux personnes autorisées.
7. Dérouler les critères d'acceptation du §12.

---

## 14. Exigences de qualité du code

Le code doit être **clair, structuré et maintenable par un bénévole** qui reprendrait la trésorerie.

### 14.1 Structure

- Découpage en couches et en fichiers conforme au §3.3 ; une responsabilité par fichier.
- Chaque fichier commence par un **cartouche** : rôle du fichier, fonctions principales, dépendances.
- À l'intérieur d'un fichier : fonctions publiques d'abord, fonctions internes ensuite, regroupées par thème avec des séparateurs de section.
- Fonctions **courtes** (objectif < 30 lignes) et à **responsabilité unique** ; au-delà, découper.
- Séparation stricte **lecture des données / calcul / présentation** : les calculs du bilan ne lisent pas le Sheet, la vue ne calcule pas de totaux.

### 14.2 Nommage

- Noms explicites **en français**, alignés sur le vocabulaire métier : `calculerSoldesParCompte`, `lireOperations`, `validerOperation`.
- `camelCase` pour variables et fonctions, `MAJUSCULES_SNAKE` pour les constantes de configuration.
- Préfixe `api` pour les fonctions appelées par le client (`apiGetBilanParCompte`) ; suffixe `_` pour les fonctions internes, qu'Apps Script rend alors non appelables depuis le client (`lireFeuille_`).
- Booléens nommés comme des questions : `estRapproche`, `estAutorise`.

### 14.3 Documentation

- **JSDoc** sur chaque fonction : description, `@param` avec type, `@return` avec type, `@throws` le cas échéant.
- Les structures de données échangées (opération, ligne de bilan, réponse API) sont décrites par des `@typedef` dans `Utils.gs`.
- Commentaires en français, expliquant le **pourquoi** plutôt que le comment.

### 14.4 Règles de codage

- JavaScript moderne (runtime V8) : `const`/`let` (jamais `var`), fonctions fléchées pour les rappels, littéraux de gabarit, déstructuration.
- **Aucune valeur magique** : toute constante vient de `CONFIG` (§3.4).
- Montants manipulés en **centimes entiers** dans les calculs (fonctions dédiées `versCentimes_` / `versEuros_`).
- Gestion d'erreurs centralisée : chaque fonction `api*` est enveloppée dans un gestionnaire unique qui renvoie `{ ok: false, message }` et journalise le détail (`console.error`).
- Pas de code mort, pas de code commenté, pas de `Logger.log` de mise au point laissé en place.
- Côté client : pas de HTML construit par concaténation de données non échappées (échappement systématique ou `textContent`) ; une fonction par écran (`afficherBilan`, `afficherSynthese`, `afficherFormulaire`).

### 14.5 Tests

- Un fichier `Tests.gs` contient des tests des fonctions métier (`Bilan.gs`, `Operations.gs`) sur des jeux de données en mémoire, exécutables depuis l'éditeur (`lancerTests()`), avec un compte rendu clair dans le journal d'exécution.
- Cas couverts au minimum : sommes rapproché / non rapproché, montants négatifs, lignes invalides ignorées, catégorie vide, chaque règle de validation de saisie.

### 14.6 Versionnement

- Chaque déploiement porte un numéro de version et une description (Déployer > Gérer les déploiements).
- Optionnel : synchronisation du code avec un dépôt Git via `clasp`.

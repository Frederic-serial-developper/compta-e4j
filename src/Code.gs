/* =============================================================================
 *  CONFIGURATION DE L'APPLICATION
 *  Seule partie du code à modifier pour adapter l'application.
 *  Ne rien modifier en dessous de ce bloc sans connaissance d'Apps Script.
 * ========================================================================== */
const CONFIG = deepFreeze_({

  /* --- 1. Application --------------------------------------------------- */
  APP: {
    TITRE: 'Comptabilité de l\'association',   // Titre affiché dans l'en-tête et l'onglet du navigateur
    FUSEAU_HORAIRE: 'Europe/Paris',             // Fuseau utilisé pour les dates (garder identique au fuseau du projet, appsscript.json)
    LOCALE: 'fr-FR',                            // Format des nombres et des dates
    DEVISE: 'EUR',                              // Devise des montants (code ISO 4217)
    JOURNALISATION_ACTIVE: true                // true = trace les ajouts et refus dans la feuille Journal
  },

  /* --- 2. Fichier et feuilles ------------------------------------------- */
  FICHIER: {
    SPREADSHEET_ID: '1hp_474UVf-2O1nBfwCjAjV6K-zg8bD8HW9IhqancPzg', // ID du Google Sheet (partie de l'URL entre /d/ et /edit)
    FEUILLE_OPERATIONS: 'Opérations',          // Feuille des opérations
    FEUILLE_JOURNAL: 'Journal',                // Feuille de journalisation (créée automatiquement si absente)
    LIGNE_EN_TETE: 1                           // Numéro de la ligne contenant les en-têtes (les données commencent juste après)
  },

  /* --- 3. Colonnes de la feuille Opérations (en-têtes exacts) ----------- */
  //  Modifier la valeur (à droite) si un en-tête est renommé dans le Sheet.
  //  L'ordre des colonnes dans le Sheet n'a pas d'importance.
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

  /* --- 4. Personnes autorisées et Journal ------------------------------ */
  //  Une ligne par personne. Chacune doit AUSSI avoir accès au Google Sheet
  //  (partage Lecteur pour le rôle Lecteur, Éditeur pour le rôle Trésorier).
  UTILISATEURS: [
    // email : adresse Google (majuscules indifférentes) ; nom : nom affiché ;
    // role : un des rôles de la section 6 ; actif : false = accès suspendu sans supprimer la ligne.
    { email: 'frederic.dib@gmail.com', nom: 'Fred', role: 'Trésorier', actif: true },
    { email: 'cecile.dubau@gmail.com', nom: 'Cécile', role: 'Lecteur', actif: true },
    { email: 'clelie.dogue@gmail.com', nom: 'Clélie', role: 'Lecteur', actif: true },
    { email: 'damien.d.kohler@wanadoo.fr', nom: 'Damien', role: 'Lecteur', actif: true },
    { email: 'genin.etienne@free.fr', nom: 'Etienne', role: 'Lecteur', actif: true },
    { email: 'benj.lehrer@gmail.com', nom: 'Ben', role: 'Lecteur', actif: true },
    { email: 'jblusignan@gmail.com', nom: 'Jibé', role: 'Lecteur', actif: true },
    { email: 'mikael.dumont@gmail.com', nom: 'Mikael', role: 'Lecteur', actif: true },
    { email: 'yannickchabas@gmail.com', nom: 'Yannick', role: 'Lecteur', actif: true }
  ],
  COLONNES_JOURNAL: ['Horodatage', 'Email', 'Action', 'Détail'], // En-têtes écrits à la création du Journal

  /* --- 5. Budget prévisionnel ------------------------------------------- */
  //  Enveloppes de dépenses suivies dans l'onglet « Budgets ». Consommé d'une
  //  enveloppe = dépenses − recettes (remboursements) de la catégorie sur l'exercice.
  BUDGET: {
    EXERCICE: '',                          // Exercice suivi ; vide = dernier exercice de la liste de choix
    SEUIL_ALERTE_POURCENT: 80,             // Part consommée (%) à partir de laquelle l'enveloppe est signalée
    ENVELOPPES: [
      // categorie : valeur exacte de la liste « Catégorie Bilan Financier » ; montant : budget en euros (> 0).
      { categorie: 'Assurance', montant: 200 },
      { categorie: 'Achat Jeux', montant: 1000 },
      { categorie: 'Convivialité', montant: 1000 },
      { categorie: 'Fournitures', montant: 500 },
      { categorie: 'Frais bancaires', montant: 50 },
      { categorie: 'Festival Dépense', montant: 2000 },
      { categorie: 'Divers', montant: 200 }
    ]
  },

  /* --- 6. Rôles --------------------------------------------------------- */
  //  Valeurs à utiliser dans le champ role de UTILISATEURS.
  ROLES: {
    LECTEUR: 'Lecteur',        // Consultation seule
    TRESORIER: 'Trésorier'     // Consultation + ajout d'opérations
  },

  /* --- 7. Règles de saisie --------------------------------------------- */
  SAISIE: {
    CHAMPS_A_LISTE: ['COMPTE', 'MOYEN', 'EXERCICE', 'CATEGORIE'], // Clés de COLONNES dont les valeurs viennent d'une liste de choix du Sheet
    CHAMPS_FACULTATIFS: ['COMMENTAIRE'],   // Clés de COLONNES non obligatoires
    LONGUEUR_MAX: { QUI: 100, QUOI: 200, COMMENTAIRE: 500 }, // Nombre maximal de caractères par champ texte
    DECIMALES_MONTANT: 2,                  // Nombre maximal de décimales d'un montant
    DATE_MIN: '2000-01-01',                // Date la plus ancienne acceptée (AAAA-MM-JJ)
    DATE_MAX_JOURS_FUTUR: 365,             // Nombre de jours acceptés après aujourd'hui
    CHAMPS_CONSERVES_APRES_AJOUT: ['COMPTE', 'MOYEN', 'EXERCICE', 'QUAND'] // Champs non vidés après un ajout (saisie en série)
  },

  /* --- 8. Affichage ----------------------------------------------------- */
  AFFICHAGE: {
    LIBELLE_SANS_CATEGORIE: 'Non catégorisé', // Catégorie affichée pour une opération sans catégorie
    LIBELLE_TOUS_EXERCICES: 'Tous',        // Libellé du choix « tous les exercices » dans les filtres
    FORMAT_DATE: 'dd/MM/yyyy',             // Format des dates affichées
    FORMAT_DATE_HEURE: 'dd/MM/yyyy HH:mm', // Format de l'heure de dernière mise à jour
    ONGLET_PAR_DEFAUT: 'BILAN'             // 'BILAN', 'SYNTHESE', 'BUDGET' ou 'AJOUT' : onglet ouvert au démarrage
  },

  /* --- 9. Technique ----------------------------------------------------- */
  TECHNIQUE: {
    CACHE_DUREE_SECONDES: 600,             // Durée de mise en cache des données et calculs (max. 21600) ; « Actualiser » relit le Sheet
    VERROU_DELAI_MS: 10000,                // Attente maximale du verrou lors d'un ajout
    PROPRIETE_VERSION_CACHE: 'VERSION_CACHE', // Nom de la propriété de script servant à invalider le cache
    ACTIONS_JOURNAL: {                     // Codes écrits dans la colonne Action du Journal
      AJOUT: 'AJOUT_OPERATION',
      REFUS: 'ACCES_REFUSE'
    }
  },

  /* --- 10. Messages affichés à l'utilisateur ---------------------------- */
  //  Les éléments entre accolades ({email}, {ligne}…) sont remplacés automatiquement.
  MESSAGES: {
    TITRE_ACCES_REFUSE: 'Accès non autorisé',
    NON_IDENTIFIE: 'Impossible de vous identifier. Connectez-vous avec votre compte Google.',
    NON_AUTORISE: 'Accès non autorisé pour {email}. Contactez le trésorier.',
    DROITS_INSUFFISANTS: 'Vous n\'avez pas les droits pour effectuer cette action.',
    CHAMP_OBLIGATOIRE: 'Ce champ est obligatoire.',
    VALEUR_HORS_LISTE: 'Valeur non autorisée.',
    TEXTE_TROP_LONG: '{max} caractères maximum.',
    MONTANT_INVALIDE: 'Montant invalide : nombre non nul (négatif = dépense), {decimales} décimales maximum.',
    DATE_INVALIDE: 'Date invalide.',
    DATE_HORS_PLAGE: 'La date doit être comprise entre le {min} et le {max}.',
    CORRIGER_ERREURS: 'Corrigez les champs signalés.',
    FICHIER_OCCUPE: 'Le fichier est occupé, réessayez dans quelques secondes.',
    OPERATION_ENREGISTREE: 'Opération enregistrée (ligne {ligne}).',
    FEUILLE_INTROUVABLE: 'Feuille "{feuille}" introuvable dans le classeur.',
    COLONNE_INTROUVABLE: 'Colonne "{colonne}" introuvable dans la feuille {feuille}.',
    PARAMETRE_INVALIDE: 'Paramètre de configuration invalide : {parametre}.',
    LISTE_NON_PARAMETREE: 'La colonne {colonne} n\'a pas de liste de choix paramétrée.',
    LIGNES_IGNOREES: '{nombre} ligne(s) ignorée(s) : montant invalide, lignes {lignes}.',
    BUDGET_CATEGORIE_INCONNUE: 'Catégorie(s) du budget absente(s) de la liste de choix : {categories}.',
    ERREUR_INATTENDUE: 'Une erreur est survenue. Réessayez ou contactez le trésorier.'
  }
});
/* ========================= FIN DE LA CONFIGURATION ======================= */

/**
 * Fige récursivement un objet (et ses sous-objets) pour empêcher toute
 * modification de la configuration pendant l'exécution.
 * Déclarée ici, et non dans Utils.gs, car elle doit exister au moment où
 * CONFIG est construit (ordre d'exécution des fichiers Apps Script).
 * @param {Object} objet Objet à figer.
 * @return {Object} Le même objet, figé.
 */
function deepFreeze_(objet) {
  Object.values(objet).forEach((valeur) => {
    if (valeur && typeof valeur === 'object') deepFreeze_(valeur);
  });
  return Object.freeze(objet);
}

/* -----------------------------------------------------------------------------
 *  Code.gs — Points d'entrée de l'application
 *
 *  Rôle : servir la page web (doGet) et exposer au navigateur les fonctions
 *         api* appelées via google.script.run.
 *  Fonctions principales : doGet, include, apiGetContexte, apiGetListesDeChoix,
 *         apiGetBilanParCompte, apiGetDetailNonRapprochees,
 *         apiGetSyntheseParCategorie, apiGetSyntheseTousExercices,
 *         apiGetSuiviBudgets, apiAjouterOperation.
 *  Dépendances : Acces.gs, Operations.gs, Bilan.gs, Donnees.gs, Utils.gs.
 * -------------------------------------------------------------------------- */

/* === Page web ============================================================ */

/**
 * Point d'entrée de la Web App : contrôle l'accès puis sert la page.
 * Aucune donnée comptable n'est intégrée à la page : elles sont chargées
 * ensuite par le navigateur via les fonctions api*.
 * @return {GoogleAppsScript.HTML.HtmlOutput} Page HTML.
 */
function doGet() {
  const modele = HtmlService.createTemplateFromFile('Index');
  modele.page = preparerPage_();
  return modele.evaluate()
    .setTitle(CONFIG.APP.TITRE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Inclut le contenu d'un fichier HTML du projet dans un modèle.
 * Utilisé dans Index.html : <?!= include('Styles') ?>.
 * @param {string} nomFichier Nom du fichier HTML, sans extension.
 * @return {string} Contenu du fichier.
 */
function include(nomFichier) {
  return HtmlService.createHtmlOutputFromFile(nomFichier).getContent();
}

/* === Fonctions appelées par le navigateur ================================ */

/**
 * Renvoie le contexte de l'utilisateur et les réglages utiles à l'interface
 * (libellés, formats, valeurs par défaut, listes de choix).
 * @return {ReponseApi} data : {@link ContexteClient}.
 */
function apiGetContexte() {
  return executerApi_(null, (utilisateur) => construireContexte_(utilisateur));
}

/**
 * Renvoie les listes de choix (Compte, Moyen, Exercice, Catégorie).
 * @param {{forcer: boolean}} parametres forcer = vider le cache et relire le Sheet
 *     (bouton « Actualiser ») ; les appels suivants profitent de cette relecture.
 * @return {ReponseApi} data : { listes, annees, avertissements }.
 */
function apiGetListesDeChoix(parametres) {
  return executerApi_(null, (utilisateur) => {
    if (parametres && parametres.forcer) invaliderCache_();
    return construireListesClient_(utilisateur);
  });
}

/**
 * Bilan par compte (rapproché / non rapproché).
 * @param {{exercice: string, dateFin: string, forcer: boolean}} filtres
 *     exercice vide = tous ; dateFin au format AAAA-MM-JJ ; forcer = ignorer le cache.
 * @return {ReponseApi} data : {@link BilanParCompte}.
 */
function apiGetBilanParCompte(filtres) {
  return executerApi_(null, () => {
    const { exercice, dateFin, forcer } = nettoyerFiltres_(filtres);
    return lireAvecCache_(`bilan|${exercice}|${dateFin}`, forcer, () => {
      const { operations, lignesIgnorees, listes } = lireDonnees_(forcer);
      const comptes = listes.COMPTE.valeurs;
      const bilan = calculerSoldesParCompte_(operations, comptes, { exercice, dateFin });
      return Object.assign(bilan, completerReponseDonnees_(lignesIgnorees));
    });
  });
}

/**
 * Liste des opérations non rapprochées d'un compte.
 * @param {{compte: string, exercice: string, dateFin: string}} filtres
 * @return {ReponseApi} data : { compte, operations: OperationAffichee[] }.
 */
function apiGetDetailNonRapprochees(filtres) {
  return executerApi_(null, () => {
    const { exercice, dateFin } = nettoyerFiltres_(filtres);
    const compte = String((filtres && filtres.compte) || '');
    const { operations } = lireDonnees_();
    return { compte, operations: listerNonRapprochees_(operations, compte, { exercice, dateFin }) };
  });
}

/**
 * Synthèse par catégorie pour un exercice ou une année civile, avec
 * comparaison à la période précédente facultative.
 * @param {{regroupement: string, periode: string, comparer: boolean, forcer: boolean}} parametres
 *     regroupement 'EXERCICE' (défaut) ou 'ANNEE' ; periode vide = la plus récente.
 * @return {ReponseApi} data : {@link SyntheseParCategorie}.
 */
function apiGetSyntheseParCategorie(parametres) {
  return executerApi_(null, () => {
    const brut = parametres || {};
    const regroupement = nettoyerRegroupement_(brut.regroupement);
    const periode = String(brut.periode || '').trim();
    const comparer = Boolean(brut.comparer);
    const forcer = Boolean(brut.forcer);
    return lireAvecCache_(`synthese|${regroupement}|${periode}|${comparer}`, forcer, () => {
      const { operations, lignesIgnorees, listes } = lireDonnees_(forcer);
      const synthese = calculerSyntheseParCategorie_(operations, listes.CATEGORIE.valeurs,
        listerPeriodes_(regroupement, operations, listes), { periode, comparer, regroupement });
      return Object.assign(synthese, completerReponseDonnees_(lignesIgnorees));
    });
  });
}

/**
 * Tableau croisé catégories × exercices ou × années civiles (soldes).
 * @param {{regroupement: string, forcer: boolean}} parametres
 * @return {ReponseApi} data : {@link VueCroisee}.
 */
function apiGetSyntheseTousExercices(parametres) {
  return executerApi_(null, () => {
    const regroupement = nettoyerRegroupement_(parametres && parametres.regroupement);
    const forcer = Boolean(parametres && parametres.forcer);
    return lireAvecCache_(`croisee|${regroupement}`, forcer, () => {
      const { operations, lignesIgnorees, listes } = lireDonnees_(forcer);
      const vue = calculerVueCroisee_(operations, listes.CATEGORIE.valeurs,
        listerPeriodes_(regroupement, operations, listes), regroupement);
      return Object.assign(vue, completerReponseDonnees_(lignesIgnorees));
    });
  });
}

/**
 * Suivi des enveloppes du budget prévisionnel (CONFIG.BUDGET) sur l'exercice suivi.
 * @param {{forcer: boolean}} parametres forcer = ignorer le cache.
 * @return {ReponseApi} data : {@link SuiviBudgets}.
 */
function apiGetSuiviBudgets(parametres) {
  return executerApi_(null, () => {
    const forcer = Boolean(parametres && parametres.forcer);
    // CONFIG.BUDGET fait partie de la clé : un budget modifié et redéployé est pris en compte aussitôt.
    return lireAvecCache_(`budgets-ventiles|${JSON.stringify(CONFIG.BUDGET)}`, forcer, () => {
      const { operations, lignesIgnorees, listes } = lireDonnees_(forcer);
      const suivi = calculerSuiviBudgets_(operations, CONFIG.BUDGET.ENVELOPPES, listes.EXERCICE.valeurs,
        listes.CATEGORIE.valeurs, { exercice: CONFIG.BUDGET.EXERCICE, seuilAlerte: CONFIG.BUDGET.SEUIL_ALERTE_POURCENT });
      const complements = completerReponseDonnees_(lignesIgnorees);
      if (suivi.categoriesHorsListe.length > 0) {
        const message = remplacerVariables_(CONFIG.MESSAGES.BUDGET_CATEGORIE_INCONNUE,
          { categories: suivi.categoriesHorsListe.join(', ') });
        complements.avertissement = [complements.avertissement, message].filter(Boolean).join(' ');
      }
      return Object.assign(suivi, complements);
    });
  });
}

/**
 * Ajoute une opération dans la feuille Opérations (rôle Trésorier).
 * Revalide entièrement la saisie : le contrôle côté navigateur n'est qu'un confort.
 * @param {SaisieOperation} saisie Données du formulaire.
 * @return {ReponseApi} data : { ligne, message } ; ou erreurs par champ.
 */
function apiAjouterOperation(saisie) {
  return executerApi_(CONFIG.ROLES.TRESORIER, (utilisateur) => {
    const listes = valeursDesListes_(lireListesDeChoix_());
    const resultat = validerOperation_(saisie || {}, listes, aujourdhuiIso_());
    if (!resultat.estValide) throw erreurValidation_(resultat.erreurs);
    const ligne = ajouterLigneOperation_(resultat.operation);
    invaliderCache_();
    const { COMPTE, COMBIEN, QUOI } = resultat.operation;
    ecrireJournal_(CONFIG.TECHNIQUE.ACTIONS_JOURNAL.AJOUT, utilisateur.email,
      `Ligne ${ligne} : ${COMPTE} ; ${COMBIEN} ; ${QUOI}`);
    return { ligne, message: remplacerVariables_(CONFIG.MESSAGES.OPERATION_ENREGISTREE, { ligne }) };
  });
}

/* === Fonctions internes ================================================== */

/**
 * Gestionnaire unique des appels api* : contrôle d'accès, contrôle du rôle,
 * conversion des erreurs en réponse { ok: false, ... }.
 * Aucune exception brute n'est transmise au navigateur.
 * @param {?string} roleRequis Rôle exigé, ou null si tout utilisateur autorisé suffit.
 * @param {function(Utilisateur): *} traitement Traitement renvoyant les données.
 * @return {ReponseApi} Réponse normalisée.
 */
function executerApi_(roleRequis, traitement) {
  try {
    const identification = identifierUtilisateur_();
    if (!identification.estAutorise) {
      journaliserRefus_(identification.email, identification.message);
      return reponseErreur_(identification.message, { accesRefuse: true });
    }
    exigerRole_(identification.utilisateur, roleRequis);
    return reponseOk_(traitement(identification.utilisateur));
  } catch (erreur) {
    return convertirErreurEnReponse_(erreur);
  }
}

/**
 * Transforme une exception en réponse lisible par le navigateur.
 * Les erreurs prévues (métier) sont renvoyées telles quelles ; les autres
 * sont journalisées et remplacées par un message générique.
 * @param {Error} erreur Exception interceptée.
 * @return {ReponseApi} Réponse d'erreur.
 */
function convertirErreurEnReponse_(erreur) {
  if (erreur && erreur.erreursChamps) {
    return reponseErreur_(CONFIG.MESSAGES.CORRIGER_ERREURS, { erreurs: erreur.erreursChamps });
  }
  if (erreur && erreur.estMetier) return reponseErreur_(erreur.message);
  console.error(erreur && erreur.stack ? erreur.stack : erreur);
  return reponseErreur_(CONFIG.MESSAGES.ERREUR_INATTENDUE);
}

/**
 * Prépare les variables du modèle Index.html : page de refus, ou en-tête
 * de l'application et éventuels problèmes de configuration.
 * @return {Object} Variables du modèle (toutes affichées échappées).
 */
function preparerPage_() {
  const page = {
    estAutorise: false,
    titre: CONFIG.APP.TITRE,
    titreRefus: CONFIG.MESSAGES.TITRE_ACCES_REFUSE,
    messageErreur: CONFIG.MESSAGES.ERREUR_INATTENDUE,
    ongletParDefaut: CONFIG.AFFICHAGE.ONGLET_PAR_DEFAUT,
    message: '',
    utilisateur: null,
    problemes: []
  };
  try {
    const identification = identifierUtilisateur_();
    if (!identification.estAutorise) {
      journaliserRefus_(identification.email, identification.message);
      return Object.assign(page, { message: identification.message });
    }
    return Object.assign(page, {
      estAutorise: true,
      utilisateur: identification.utilisateur,
      problemes: verifierConfiguration_()
    });
  } catch (erreur) {
    return Object.assign(page, { message: convertirErreurEnReponse_(erreur).message });
  }
}

/**
 * Contrôle la cohérence de CONFIG avec le classeur : feuilles, en-têtes et
 * valeurs des paramètres. Appelée à l'ouverture de l'application.
 * @return {string[]} Messages lisibles, vide si tout est correct.
 */
function verifierConfiguration_() {
  const problemes = verifierParametres_();
  const nomFeuille = CONFIG.FICHIER.FEUILLE_OPERATIONS;
  try {
    listerColonnesManquantes_(nomFeuille, CONFIG.COLONNES).forEach((colonne) => problemes.push(
      remplacerVariables_(CONFIG.MESSAGES.COLONNE_INTROUVABLE, { colonne, feuille: nomFeuille })));
  } catch (erreur) {
    problemes.push(convertirErreurEnReponse_(erreur).message);
  }
  return problemes;
}

/**
 * Vérifie les paramètres de CONFIG qui n'ont qu'un nombre limité de valeurs possibles.
 * @return {string[]} Messages d'erreur.
 */
function verifierParametres_() {
  const { SAISIE, AFFICHAGE, BUDGET } = CONFIG;
  const clesColonnes = Object.keys(CONFIG.COLONNES);
  const emails = CONFIG.UTILISATEURS.map((personne) => texte_(personne.email).toLowerCase());
  const categoriesBudget = BUDGET.ENVELOPPES.map((enveloppe) => texte_(enveloppe.categorie));
  const controles = {
    'UTILISATEURS (email)': emails.every((email) => /^[^\s@]+@[^\s@]+$/.test(email))
      && new Set(emails).size === emails.length,
    'UTILISATEURS (role)': CONFIG.UTILISATEURS.every((personne) => normaliserRole_(personne.role) !== null),
    'BUDGET.ENVELOPPES (categorie)': categoriesBudget.every((categorie) => categorie !== '')
      && new Set(categoriesBudget).size === categoriesBudget.length,
    'BUDGET.ENVELOPPES (montant)': BUDGET.ENVELOPPES.every((enveloppe) =>
      typeof enveloppe.montant === 'number' && enveloppe.montant > 0),
    'BUDGET.SEUIL_ALERTE_POURCENT': typeof BUDGET.SEUIL_ALERTE_POURCENT === 'number'
      && BUDGET.SEUIL_ALERTE_POURCENT >= 0 && BUDGET.SEUIL_ALERTE_POURCENT <= 100,
    'AFFICHAGE.ONGLET_PAR_DEFAUT': ['BILAN', 'SYNTHESE', 'BUDGET', 'AJOUT'].includes(AFFICHAGE.ONGLET_PAR_DEFAUT),
    'SAISIE.CHAMPS_A_LISTE': SAISIE.CHAMPS_A_LISTE.every((cle) => clesColonnes.includes(cle)),
    'SAISIE.CHAMPS_FACULTATIFS': SAISIE.CHAMPS_FACULTATIFS.every((cle) => clesColonnes.includes(cle)),
    'SAISIE.CHAMPS_CONSERVES_APRES_AJOUT':
      SAISIE.CHAMPS_CONSERVES_APRES_AJOUT.every((cle) => clesColonnes.includes(cle)),
    'SAISIE.DECIMALES_MONTANT': Number.isInteger(SAISIE.DECIMALES_MONTANT) && SAISIE.DECIMALES_MONTANT >= 0,
    'SAISIE.DATE_MIN': parserDateIso_(SAISIE.DATE_MIN) !== null
  };
  return Object.keys(controles)
    .filter((parametre) => !controles[parametre])
    .map((parametre) => remplacerVariables_(CONFIG.MESSAGES.PARAMETRE_INVALIDE, { parametre }));
}

/**
 * Construit le contexte transmis au navigateur au démarrage.
 * @param {Utilisateur} utilisateur Utilisateur identifié.
 * @return {ContexteClient} Contexte.
 */
function construireContexte_(utilisateur) {
  const estTresorier = utilisateur.role === CONFIG.ROLES.TRESORIER;
  const problemes = verifierConfiguration_();
  return {
    utilisateur,
    estTresorier,
    ajoutPossible: estTresorier && problemes.length === 0,
    problemes,
    urlClasseur: estTresorier ? ouvrirClasseur_().getUrl() : '',
    reglages: construireReglagesClient_(),
    listes: lireListesSiPossible_(utilisateur)
  };
}

/**
 * Lit les listes de choix sans faire échouer l'ouverture de l'application si
 * la feuille Opérations est mal configurée (le problème est déjà signalé).
 * @param {Utilisateur} utilisateur Utilisateur identifié.
 * @return {?Object} Listes au format client, ou null si illisibles.
 */
function lireListesSiPossible_(utilisateur) {
  try {
    return construireListesClient_(utilisateur);
  } catch (erreur) {
    if (!erreur.estMetier) throw erreur;
    return null;
  }
}

/**
 * Extrait de CONFIG les réglages utiles à l'interface (source de vérité unique).
 * @return {Object} Réglages sérialisables.
 */
function construireReglagesClient_() {
  const { APP, AFFICHAGE, SAISIE, COLONNES, MESSAGES } = CONFIG;
  return {
    locale: APP.LOCALE,
    devise: APP.DEVISE,
    libelleTous: AFFICHAGE.LIBELLE_TOUS_EXERCICES,
    ongletParDefaut: AFFICHAGE.ONGLET_PAR_DEFAUT,
    colonnes: COLONNES,
    saisie: Object.assign({}, SAISIE, { dateMax: ajouterJoursIso_(aujourdhuiIso_(), SAISIE.DATE_MAX_JOURS_FUTUR) }),
    messages: MESSAGES
  };
}

/**
 * Listes de choix au format attendu par le navigateur. Les avertissements
 * (liste non paramétrée) ne sont transmis qu'au trésorier.
 * @param {Utilisateur} utilisateur Utilisateur identifié.
 * @return {{listes: Object<string, string[]>, annees: string[], avertissements: string[]}}
 *     annees : années civiles des opérations datées (synthèse par année).
 */
function construireListesClient_(utilisateur) {
  const { listes, operations } = lireDonnees_();
  const avertissements = Object.keys(listes)
    .filter((cle) => !listes[cle].estParametree)
    .map((cle) => remplacerVariables_(CONFIG.MESSAGES.LISTE_NON_PARAMETREE, { colonne: CONFIG.COLONNES[cle] }));
  return {
    listes: valeursDesListes_(listes),
    annees: listerAnnees_(operations),
    avertissements: utilisateur.role === CONFIG.ROLES.TRESORIER ? avertissements : []
  };
}

/**
 * Normalise les filtres reçus du navigateur (valeurs non fiables).
 * @param {Object} filtres Filtres bruts.
 * @return {{exercice: string, dateFin: string, forcer: boolean}} Filtres nettoyés.
 */
function nettoyerFiltres_(filtres) {
  const brut = filtres || {};
  const dateFin = parserDateIso_(String(brut.dateFin || '')) ? String(brut.dateFin) : '';
  return {
    exercice: String(brut.exercice || '').trim(),
    dateFin,
    forcer: Boolean(brut.forcer)
  };
}

/**
 * Normalise le mode de regroupement reçu du navigateur.
 * @param {*} valeur Valeur brute.
 * @return {string} 'ANNEE' ou 'EXERCICE' (par défaut).
 */
function nettoyerRegroupement_(valeur) {
  return valeur === REGROUPEMENTS_.ANNEE ? REGROUPEMENTS_.ANNEE : REGROUPEMENTS_.EXERCICE;
}

/**
 * Périodes disponibles pour un regroupement : exercices de la liste de choix,
 * ou années civiles présentes dans les données.
 * @param {string} regroupement 'EXERCICE' ou 'ANNEE'.
 * @param {Operation[]} operations Opérations lues.
 * @param {Object<string, {valeurs: string[]}>} listes Listes de choix.
 * @return {string[]} Périodes, de la plus ancienne à la plus récente.
 */
function listerPeriodes_(regroupement, operations, listes) {
  return regroupement === REGROUPEMENTS_.ANNEE ? listerAnnees_(operations) : listes.EXERCICE.valeurs;
}

/**
 * Informations communes aux réponses calculées : horodatage et avertissement
 * sur les lignes ignorées.
 * @param {number[]} lignesIgnorees Numéros des lignes au montant invalide.
 * @return {{miseAJour: string, avertissement: string}}
 */
function completerReponseDonnees_(lignesIgnorees) {
  const avertissement = lignesIgnorees.length === 0 ? '' : remplacerVariables_(
    CONFIG.MESSAGES.LIGNES_IGNOREES, { nombre: lignesIgnorees.length, lignes: lignesIgnorees.join(', ') });
  return { miseAJour: formaterDateHeure_(new Date()), avertissement };
}

/**
 * Trace un refus d'accès dans le Journal (sans bloquer en cas d'échec).
 * @param {string} email Adresse détectée (éventuellement vide).
 * @param {string} detail Motif du refus.
 */
function journaliserRefus_(email, detail) {
  ecrireJournal_(CONFIG.TECHNIQUE.ACTIONS_JOURNAL.REFUS, email, detail);
}

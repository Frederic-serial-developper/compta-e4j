/* -----------------------------------------------------------------------------
 *  Donnees.gs — Accès aux données du Google Sheet
 *
 *  Rôle : seul fichier qui lit et écrit le classeur. Repère les colonnes par
 *         leur en-tête, lit les opérations et les listes de choix, ajoute une
 *         ligne, gère le cache et le Journal.
 *  Fonctions principales : ouvrirClasseur_, lireOperations_,
 *         lireListesDeChoix_, lireValeursDistinctes_,
 *         listerColonnesManquantes_, ajouterLigneOperation_, lireAvecCache_,
 *         invaliderCache_, ecrireJournal_.
 *  Dépendances : CONFIG (Code.gs), Utils.gs.
 * -------------------------------------------------------------------------- */

/** Classeur ouvert, mémorisé le temps d'une exécution. */
let classeurMemorise_ = null;

/** Contenu brut de la feuille Opérations, mémorisé le temps d'une exécution. */
let feuilleOperationsMemorisee_ = null;

/* === Lecture des opérations ============================================= */

/**
 * Lit toutes les opérations (une seule lecture de la feuille).
 * Les lignes vides sont ignorées ; les lignes au montant non numérique sont
 * ignorées et leurs numéros renvoyés pour être signalés.
 * @return {{operations: Operation[], lignesIgnorees: number[]}}
 * @throws {Error} Si la feuille ou une colonne déclarée est introuvable.
 */
function lireOperations_() {
  const { index, lignes, premiereLigne } = lireFeuilleOperations_();
  const operations = [];
  const lignesIgnorees = [];
  lignes.forEach((valeurs, position) => {
    if (estLigneVide_(valeurs)) return;
    const numeroLigne = premiereLigne + position;
    const operation = convertirLigneEnOperation_(valeurs, index, numeroLigne);
    if (operation) operations.push(operation);
    else lignesIgnorees.push(numeroLigne);
  });
  return { operations, lignesIgnorees };
}

/**
 * Convertit une ligne brute du Sheet en opération.
 * @param {Array<*>} valeurs Valeurs de la ligne.
 * @param {Object<string, number>} index Position de chaque colonne (clés de CONFIG.COLONNES).
 * @param {number} numeroLigne Numéro de ligne dans le Sheet.
 * @return {?Operation} null si le montant n'est pas numérique.
 */
function convertirLigneEnOperation_(valeurs, index, numeroLigne) {
  const montant = valeurs[index.COMBIEN];
  if (typeof montant !== 'number' || !isFinite(montant)) return null;
  const quand = valeurs[index.QUAND];
  const dateIso = celluleVersDateIso_(quand);
  return {
    ligne: numeroLigne,
    compte: texte_(valeurs[index.COMPTE]),
    dateIso,
    dateAffichee: dateIso ? formaterDate_(quand) : '',
    qui: texte_(valeurs[index.QUI]),
    quoi: texte_(valeurs[index.QUOI]),
    moyen: texte_(valeurs[index.MOYEN]),
    centimes: versCentimes_(montant),
    exercice: texte_(valeurs[index.EXERCICE]),
    estRapproche: estVrai_(valeurs[index.RAPPROCHE]),
    categorie: texte_(valeurs[index.CATEGORIE]),
    commentaire: texte_(valeurs[index.COMMENTAIRE])
  };
}

/**
 * Interprète une case « Rapproché » : vide, null ou absente = FAUX.
 * @param {*} valeur Valeur de la cellule.
 * @return {boolean} Vrai si la case est cochée.
 */
function estVrai_(valeur) {
  if (valeur === true) return true;
  return ['vrai', 'true', 'oui'].includes(normaliserLibelle_(valeur));
}

/**
 * Valeurs distinctes non vides d'une colonne des opérations, triées.
 * @param {string} cle Clé de CONFIG.COLONNES.
 * @return {string[]} Valeurs triées alphabétiquement.
 */
function lireValeursDistinctes_(cle) {
  const { index, lignes } = lireFeuilleOperations_();
  const valeurs = new Set(lignes.map((ligne) => texte_(ligne[index[cle]])).filter((v) => v !== ''));
  return Array.from(valeurs).sort((a, b) => a.localeCompare(b, CONFIG.APP.LOCALE));
}

/* === Listes de choix ===================================================== */

/**
 * Lit les listes de choix paramétrées dans la validation de données des
 * colonnes (ordre conservé). À défaut, reprend les valeurs déjà saisies.
 * @return {Object<string, {valeurs: string[], estParametree: boolean}>}
 *     Une entrée par clé de CONFIG.SAISIE.CHAMPS_A_LISTE.
 */
function lireListesDeChoix_() {
  const { feuille, index, premiereLigne } = lireFeuilleOperations_();
  const listes = {};
  CONFIG.SAISIE.CHAMPS_A_LISTE.forEach((cle) => {
    const regle = feuille.getRange(premiereLigne, index[cle] + 1).getDataValidation();
    const valeurs = lireValeursDeValidation_(regle);
    listes[cle] = valeurs.length > 0
      ? { valeurs, estParametree: true }
      : { valeurs: lireValeursDistinctes_(cle), estParametree: false };
  });
  return listes;
}

/**
 * Extrait les valeurs d'une règle de validation « liste d'éléments » ou
 * « liste à partir d'une plage ».
 * @param {?GoogleAppsScript.Spreadsheet.DataValidation} regle Règle de la cellule.
 * @return {string[]} Valeurs dans l'ordre de la règle, vide si non lisible.
 */
function lireValeursDeValidation_(regle) {
  if (!regle) return [];
  const type = regle.getCriteriaType();
  const [critere] = regle.getCriteriaValues();
  const { VALUE_IN_LIST, VALUE_IN_RANGE } = SpreadsheetApp.DataValidationCriteria;
  let valeurs = [];
  if (type === VALUE_IN_LIST) valeurs = critere;
  if (type === VALUE_IN_RANGE) valeurs = [].concat(...critere.getValues());
  return valeurs.map(texte_).filter((valeur) => valeur !== '');
}

/**
 * Réduit les listes de choix à leurs seules valeurs.
 * @param {Object<string, {valeurs: string[]}>} listes Listes lues.
 * @return {Object<string, string[]>} Valeurs par clé.
 */
function valeursDesListes_(listes) {
  const resultat = {};
  Object.keys(listes).forEach((cle) => { resultat[cle] = listes[cle].valeurs; });
  return resultat;
}

/* === Structure du classeur =============================================== */

/**
 * Ouvre le classeur déclaré dans CONFIG (une seule fois par exécution).
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet} Classeur.
 */
function ouvrirClasseur_() {
  if (!classeurMemorise_) classeurMemorise_ = SpreadsheetApp.openById(CONFIG.FICHIER.SPREADSHEET_ID);
  return classeurMemorise_;
}

/**
 * Renvoie une feuille du classeur par son nom.
 * @param {string} nom Nom de la feuille.
 * @return {GoogleAppsScript.Spreadsheet.Sheet} Feuille.
 * @throws {Error} Erreur métier explicite si la feuille n'existe pas.
 */
function obtenirFeuille_(nom) {
  const feuille = ouvrirClasseur_().getSheetByName(nom);
  if (!feuille) throw erreurMetier_(remplacerVariables_(CONFIG.MESSAGES.FEUILLE_INTROUVABLE, { feuille: nom }));
  return feuille;
}

/**
 * Liste les colonnes déclarées dans CONFIG mais absentes d'une feuille.
 * @param {string} nomFeuille Nom de la feuille.
 * @param {Object<string, string>} colonnes En-têtes attendus (clé → libellé).
 * @return {string[]} Libellés des en-têtes manquants.
 */
function listerColonnesManquantes_(nomFeuille, colonnes) {
  const feuille = obtenirFeuille_(nomFeuille);
  const largeur = Math.max(feuille.getLastColumn(), 1);
  const entetes = feuille.getRange(CONFIG.FICHIER.LIGNE_EN_TETE, 1, 1, largeur).getValues()[0];
  const presents = entetes.map(normaliserLibelle_);
  return Object.values(colonnes).filter((libelle) => !presents.includes(normaliserLibelle_(libelle)));
}

/**
 * Associe chaque clé de colonne à sa position, d'après la ligne d'en-tête.
 * La comparaison ignore la casse et les espaces superflus.
 * @param {Array<*>} entetes Valeurs de la ligne d'en-tête.
 * @param {Object<string, string>} colonnes En-têtes attendus (clé → libellé).
 * @param {string} nomFeuille Nom de la feuille (pour le message d'erreur).
 * @return {Object<string, number>} Position (base 0) par clé.
 * @throws {Error} Erreur métier si un en-tête est introuvable.
 */
function indexerColonnes_(entetes, colonnes, nomFeuille) {
  const normalises = entetes.map(normaliserLibelle_);
  const index = {};
  Object.keys(colonnes).forEach((cle) => {
    const position = normalises.indexOf(normaliserLibelle_(colonnes[cle]));
    if (position < 0) {
      throw erreurMetier_(remplacerVariables_(CONFIG.MESSAGES.COLONNE_INTROUVABLE,
        { colonne: colonnes[cle], feuille: nomFeuille }));
    }
    index[cle] = position;
  });
  return index;
}

/**
 * Lit la feuille Opérations en un seul appel (mémorisé le temps de l'exécution).
 * @param {boolean} [forcer] Vrai pour relire même si déjà mémorisée.
 * @return {{feuille: GoogleAppsScript.Spreadsheet.Sheet, index: Object<string, number>,
 *     largeur: number, lignes: Array<Array<*>>, premiereLigne: number}}
 */
function lireFeuilleOperations_(forcer) {
  if (feuilleOperationsMemorisee_ && !forcer) return feuilleOperationsMemorisee_;
  const nomFeuille = CONFIG.FICHIER.FEUILLE_OPERATIONS;
  const feuille = obtenirFeuille_(nomFeuille);
  const valeurs = feuille.getDataRange().getValues();
  const ligneEnTete = CONFIG.FICHIER.LIGNE_EN_TETE;
  const entetes = valeurs[ligneEnTete - 1] || [];
  feuilleOperationsMemorisee_ = {
    feuille,
    index: indexerColonnes_(entetes, CONFIG.COLONNES, nomFeuille),
    largeur: entetes.length,
    lignes: valeurs.slice(ligneEnTete),
    premiereLigne: ligneEnTete + 1
  };
  return feuilleOperationsMemorisee_;
}

/* === Écriture d'une opération ============================================ */

/**
 * Écrit une opération validée sur la première ligne vide après la dernière
 * opération, sous verrou pour éviter que deux ajouts simultanés s'écrasent.
 * @param {OperationValidee} operation Opération validée (clés de CONFIG.COLONNES).
 * @return {number} Numéro de la ligne écrite.
 * @throws {Error} Erreur métier si le verrou n'est pas obtenu à temps.
 */
function ajouterLigneOperation_(operation) {
  const verrou = LockService.getDocumentLock() || LockService.getScriptLock();
  if (!verrou.tryLock(CONFIG.TECHNIQUE.VERROU_DELAI_MS)) throw erreurMetier_(CONFIG.MESSAGES.FICHIER_OCCUPE);
  try {
    // Relecture sous verrou : un autre ajout a pu avoir lieu depuis la première lecture.
    const donnees = lireFeuilleOperations_(true);
    const ligneCible = trouverLigneLibre_(donnees);
    preparerLigne_(donnees, ligneCible);
    ecrireValeurs_(donnees, ligneCible, convertirPourLeSheet_(operation));
    SpreadsheetApp.flush();
    return ligneCible;
  } finally {
    verrou.releaseLock();
  }
}

/**
 * Numéro de la première ligne libre après la dernière ligne non vide.
 * (getLastRow ne convient pas : des cases à cocher décochées peuvent être
 * pré-remplies très bas dans la feuille.)
 * @param {{lignes: Array<Array<*>>, premiereLigne: number}} donnees Feuille lue.
 * @return {number} Numéro de ligne.
 */
function trouverLigneLibre_(donnees) {
  let derniere = donnees.lignes.length - 1;
  while (derniere >= 0 && estLigneVide_(donnees.lignes[derniere])) derniere -= 1;
  return donnees.premiereLigne + derniere + 1;
}

/**
 * Prépare la ligne cible : ajoute une ligne si la feuille est pleine, puis
 * recopie le format et la validation (case à cocher, listes) de la ligne précédente.
 * @param {{feuille: GoogleAppsScript.Spreadsheet.Sheet, largeur: number, premiereLigne: number}} donnees
 * @param {number} ligneCible Numéro de la ligne à écrire.
 */
function preparerLigne_(donnees, ligneCible) {
  const { feuille, largeur, premiereLigne } = donnees;
  if (ligneCible > feuille.getMaxRows()) feuille.insertRowsAfter(feuille.getMaxRows(), 1);
  if (ligneCible <= premiereLigne) return;
  const modele = feuille.getRange(ligneCible - 1, 1, 1, largeur);
  const cible = feuille.getRange(ligneCible, 1, 1, largeur);
  modele.copyTo(cible, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  modele.copyTo(cible, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
}

/**
 * Convertit une opération validée en valeurs typées pour le Sheet :
 * date en objet Date, montant en nombre, rapprochement en booléen.
 * @param {OperationValidee} operation Opération validée.
 * @return {Object<string, *>} Valeur par clé de CONFIG.COLONNES.
 */
function convertirPourLeSheet_(operation) {
  const { annee, mois, jour } = parserDateIso_(operation.QUAND);
  return Object.assign({}, operation, {
    QUAND: new Date(annee, mois - 1, jour),
    COMBIEN: Number(operation.COMBIEN),
    RAPPROCHE: operation.RAPPROCHE === true
  });
}

/**
 * Écrit les valeurs dans les seules colonnes connues : les autres colonnes
 * de la ligne (éventuelles formules) ne sont pas touchées.
 * @param {{feuille: GoogleAppsScript.Spreadsheet.Sheet, index: Object<string, number>}} donnees
 * @param {number} ligneCible Numéro de ligne.
 * @param {Object<string, *>} valeurs Valeur par clé de CONFIG.COLONNES.
 */
function ecrireValeurs_(donnees, ligneCible, valeurs) {
  const { feuille, index } = donnees;
  Object.keys(CONFIG.COLONNES).forEach((cle) => {
    feuille.getRange(ligneCible, index[cle] + 1).setValue(valeurs[cle]);
  });
}

/* === Cache =============================================================== */

/**
 * Renvoie un résultat depuis le cache, ou le calcule et le met en cache.
 * La version du cache fait partie de la clé : l'incrémenter (invaliderCache_)
 * rend obsolètes toutes les entrées d'un coup.
 * @param {string} cle Clé lisible (inclut les filtres).
 * @param {boolean} forcer Vrai pour ignorer le cache (bouton « Actualiser »).
 * @param {function(): Object} calculer Calcul à effectuer en cas d'absence.
 * @return {Object} Résultat.
 */
function lireAvecCache_(cle, forcer, calculer) {
  const cache = CacheService.getScriptCache();
  const cleComplete = hacher_(`${lireVersionCache_()}|${cle}`);
  const enCache = forcer ? null : cache.get(cleComplete);
  if (enCache) return JSON.parse(enCache);
  const resultat = calculer();
  try {
    cache.put(cleComplete, JSON.stringify(resultat), CONFIG.TECHNIQUE.CACHE_DUREE_SECONDES);
  } catch (erreur) {
    // Résultat trop volumineux pour le cache (100 Ko) : il sera simplement recalculé.
    console.warn(`Mise en cache impossible (${cle}) : ${erreur.message}`);
  }
  return resultat;
}

/**
 * Rend obsolètes toutes les entrées du cache (après un ajout d'opération).
 */
function invaliderCache_() {
  PropertiesService.getScriptProperties()
    .setProperty(CONFIG.TECHNIQUE.PROPRIETE_VERSION_CACHE, String(Date.now()));
}

/**
 * Version courante du cache.
 * @return {string} Version.
 */
function lireVersionCache_() {
  return PropertiesService.getScriptProperties().getProperty(CONFIG.TECHNIQUE.PROPRIETE_VERSION_CACHE) || '0';
}

/**
 * Condense une clé (les clés de cache sont limitées à 250 caractères).
 * @param {string} texte Clé lisible.
 * @return {string} Empreinte en base 64.
 */
function hacher_(texte) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, texte,
    Utilities.Charset.UTF_8));
}

/* === Journal ============================================================= */

/**
 * Ajoute une ligne au Journal. N'interrompt jamais le traitement : une
 * personne non autorisée ou en lecture seule ne peut pas écrire dans le Sheet.
 * @param {string} action Code d'action (CONFIG.TECHNIQUE.ACTIONS_JOURNAL).
 * @param {string} email Adresse de l'utilisateur.
 * @param {string} detail Détail libre.
 */
function ecrireJournal_(action, email, detail) {
  if (!CONFIG.APP.JOURNALISATION_ACTIVE) return;
  try {
    const classeur = ouvrirClasseur_();
    const nom = CONFIG.FICHIER.FEUILLE_JOURNAL;
    let feuille = classeur.getSheetByName(nom);
    if (!feuille) {
      feuille = classeur.insertSheet(nom);
      feuille.appendRow(CONFIG.COLONNES_JOURNAL);
    }
    feuille.appendRow([new Date(), email || '', action, neutraliserFormule_(String(detail || ''))]);
  } catch (erreur) {
    console.warn(`Journalisation impossible (${action}, ${email}) : ${erreur.message}`);
  }
}

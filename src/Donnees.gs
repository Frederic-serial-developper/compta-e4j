/* -----------------------------------------------------------------------------
 *  Donnees.gs — Accès aux données du Google Sheet
 *
 *  Rôle : seul fichier qui lit et écrit le classeur. Repère les colonnes par
 *         leur en-tête, lit les opérations et les listes de choix, ajoute une
 *         ligne, coche les opérations pointées, gère le cache et le Journal.
 *  Fonctions principales : ouvrirClasseur_, lireDonnees_, lireOperations_,
 *         lireListesDeChoix_, listerColonnesManquantes_, ajouterLigneOperation_,
 *         cocherRapprochees_, lireAvecCache_, invaliderCache_, ecrireJournal_.
 *  Dépendances : CONFIG (Code.gs), Utils.gs.
 * -------------------------------------------------------------------------- */

/** Classeur ouvert, mémorisé le temps d'une exécution. */
let classeurMemorise_ = null;

/** Contenu brut de la feuille Opérations, mémorisé le temps d'une exécution. */
let feuilleOperationsMemorisee_ = null;

/** Données lues (lireDonnees_), mémorisées le temps d'une exécution. */
let donneesMemorisees_ = null;

/** Version du cache, mémorisée le temps d'une exécution. */
let versionCacheMemorisee_ = null;

/**
 * Taille (en caractères) des morceaux d'une valeur volumineuse en cache :
 * 25 000 caractères de 3 octets au plus restent sous la limite de 100 Ko par valeur.
 */
const TAILLE_MORCEAU_CACHE_ = 25000;

/* === Données partagées par les api* ===================================== */

/**
 * Opérations et listes de choix, mises en cache : un
 * changement de filtre ou d'onglet ne relit pas le classeur.
 * @param {boolean} [forcer] Vrai pour relire le Sheet même si le cache est valide.
 * @return {{operations: Operation[], lignesIgnorees: number[],
 *     listes: Object<string, {valeurs: string[], estParametree: boolean}>}}
 * @throws {Error} Si la feuille ou une colonne déclarée est introuvable.
 */
function lireDonnees_(forcer) {
  if (donneesMemorisees_ && !forcer) return donneesMemorisees_;
  const cle = `${lireVersionCache_()}|donnees`;
  let donnees = forcer ? null : lireCacheVolumineux_(cle);
  if (!donnees) {
    donnees = Object.assign(lireOperations_(), { listes: lireListesDeChoix_() });
    ecrireCacheVolumineux_(cle, donnees);
  }
  donneesMemorisees_ = donnees;
  return donnees;
}

/* === Lecture des opérations ============================================= */

/**
 * Lit toutes les opérations (une seule lecture de la feuille).
 * Les lignes vides sont ignorées ; les lignes au montant non numérique sont
 * ignorées et leurs numéros renvoyés pour être signalés.
 * @param {boolean} [forcer] Vrai pour relire la feuille même si déjà lue pendant l'exécution.
 * @return {{operations: Operation[], lignesIgnorees: number[]}}
 * @throws {Error} Si la feuille ou une colonne déclarée est introuvable.
 */
function lireOperations_(forcer) {
  const { index, lignes, premiereLigne } = lireFeuilleOperations_(forcer);
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
  return {
    ligne: numeroLigne,
    compte: texte_(valeurs[index.COMPTE]),
    dateIso: celluleVersDateIso_(valeurs[index.QUAND]),
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

/* === Listes de choix ===================================================== */

/**
 * Lit les listes de choix paramétrées dans la validation de données des
 * colonnes (menu déroulant, ordre conservé). Les opérations ne sont pas lues :
 * seuls la ligne d'en-tête et les règles de la première ligne de données le sont
 * (ou, pour une colonne de tableau, son type « Menu déroulant »).
 * Une colonne sans liste paramétrée renvoie une liste vide.
 * @return {Object<string, {valeurs: string[], estParametree: boolean}>}
 *     Une entrée par clé de CONFIG.SAISIE.CHAMPS_A_LISTE.
 */
function lireListesDeChoix_() {
  const nomFeuille = CONFIG.FICHIER.FEUILLE_OPERATIONS;
  const feuille = obtenirFeuille_(nomFeuille);
  const ligneEnTete = CONFIG.FICHIER.LIGNE_EN_TETE;
  const largeur = Math.max(feuille.getLastColumn(), 1);
  const entetes = feuille.getRange(ligneEnTete, 1, 1, largeur).getValues()[0];
  const index = indexerColonnes_(entetes, CONFIG.COLONNES, nomFeuille);
  const regles = feuille.getRange(ligneEnTete + 1, 1, 1, largeur).getDataValidations()[0];
  let menusDesTableaux = null;
  const listes = {};
  CONFIG.SAISIE.CHAMPS_A_LISTE.forEach((cle) => {
    let valeurs = lireValeursDeValidation_(regles[index[cle]]);
    if (valeurs.length === 0) {
      // Colonne d'un tableau (Format > Convertir en tableau) : son menu déroulant
      // n'est pas visible par getDataValidations, il est lu via l'API Sheets.
      menusDesTableaux = menusDesTableaux || lireMenusDesTableaux_(feuille);
      valeurs = menusDesTableaux[normaliserLibelle_(CONFIG.COLONNES[cle])] || [];
    }
    listes[cle] = { valeurs, estParametree: valeurs.length > 0 };
  });
  return listes;
}

/**
 * Lit les menus déroulants des colonnes des tableaux d'une feuille, via le
 * service avancé Sheets (activé dans appsscript.json). Un échec n'interrompt
 * pas le traitement : les listes concernées restent vides.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} feuille Feuille contenant les tableaux.
 * @return {Object<string, string[]>} Valeurs par nom de colonne normalisé.
 */
function lireMenusDesTableaux_(feuille) {
  const menus = {};
  try {
    const reponse = Sheets.Spreadsheets.get(CONFIG.FICHIER.SPREADSHEET_ID,
      { fields: 'sheets(properties.sheetId,tables(columnProperties))' });
    const donneesFeuille = (reponse.sheets || [])
      .find((onglet) => onglet.properties.sheetId === feuille.getSheetId());
    ((donneesFeuille && donneesFeuille.tables) || []).forEach((tableau) => {
      (tableau.columnProperties || []).forEach((colonne) => {
        const valeurs = lireValeursDeConditionApi_(colonne.dataValidationRule);
        if (valeurs.length > 0) menus[normaliserLibelle_(colonne.columnName)] = valeurs;
      });
    });
  } catch (erreur) {
    console.warn(`Lecture des menus des tableaux impossible : ${erreur.message}`);
  }
  return menus;
}

/**
 * Extrait les valeurs d'une règle de validation de l'API Sheets
 * (liste d'éléments, ou plage référencée par une formule).
 * @param {?Object} regle DataValidationRule de l'API Sheets.
 * @return {string[]} Valeurs dans l'ordre de la règle, vide si non lisible.
 */
function lireValeursDeConditionApi_(regle) {
  const condition = regle && regle.condition;
  if (!condition) return [];
  const elements = (condition.values || []).map((valeur) => valeur.userEnteredValue);
  let valeurs = [];
  if (condition.type === 'ONE_OF_LIST') valeurs = elements;
  if (condition.type === 'ONE_OF_RANGE' && elements[0]) {
    valeurs = [].concat(...ouvrirClasseur_().getRange(String(elements[0]).replace(/^=/, '')).getValues());
  }
  return valeurs.map(texte_).filter((valeur) => valeur !== '');
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
  return executerSousVerrou_(() => {
    // Relecture sous verrou : un autre ajout a pu avoir lieu depuis la première lecture.
    const donnees = lireFeuilleOperations_(true);
    const ligneCible = trouverLigneLibre_(donnees);
    preparerLigne_(donnees, ligneCible);
    ecrireValeurs_(donnees, ligneCible, convertirPourLeSheet_(operation));
    SpreadsheetApp.flush();
    return ligneCible;
  });
}

/**
 * Exécute un traitement sous le verrou du document, pour éviter que deux
 * écritures simultanées s'écrasent.
 * @param {function(): *} traitement Traitement à exécuter.
 * @return {*} Résultat du traitement.
 * @throws {Error} Erreur métier si le verrou n'est pas obtenu à temps.
 */
function executerSousVerrou_(traitement) {
  const verrou = LockService.getDocumentLock() || LockService.getScriptLock();
  if (!verrou.tryLock(CONFIG.TECHNIQUE.VERROU_DELAI_MS)) throw erreurMetier_(CONFIG.MESSAGES.FICHIER_OCCUPE);
  try {
    return traitement();
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

/* === Pointage ============================================================ */

/**
 * Coche la case Rapproché d'un ensemble de lignes, en une seule écriture.
 * Tout ou rien : les opérations sont relues sous verrou et passées à
 * `controler`, qui lève une erreur (rien n'est alors écrit) si la demande ne
 * correspond plus au Sheet.
 * @param {function(Operation[]): {lignes: number[]}} controler Reçoit les
 *     opérations relues et renvoie les lignes à cocher (avec d'autres informations éventuelles).
 * @return {{lignes: number[]}} Résultat de `controler`.
 * @throws {Error} Erreur métier si le verrou n'est pas obtenu ou si `controler` refuse.
 */
function cocherRapprochees_(controler) {
  return executerSousVerrou_(() => {
    const resultat = controler(lireOperations_(true).operations);
    const { feuille, index } = lireFeuilleOperations_();
    const cellules = resultat.lignes.map((ligne) => feuille.getRange(ligne, index.RAPPROCHE + 1).getA1Notation());
    feuille.getRangeList(cellules).setValue(true);
    SpreadsheetApp.flush();
    return resultat;
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
 * Met en cache une valeur trop volumineuse pour une seule entrée (100 Ko),
 * découpée en morceaux. Un échec n'interrompt pas le traitement.
 * @param {string} cle Clé lisible.
 * @param {Object} valeur Valeur sérialisable.
 */
function ecrireCacheVolumineux_(cle, valeur) {
  const texte = JSON.stringify(valeur);
  const prefixe = hacher_(cle);
  const nombre = Math.max(Math.ceil(texte.length / TAILLE_MORCEAU_CACHE_), 1);
  const morceaux = { [prefixe]: String(nombre) };
  for (let i = 0; i < nombre; i += 1) {
    morceaux[`${prefixe}|${i}`] = texte.slice(i * TAILLE_MORCEAU_CACHE_, (i + 1) * TAILLE_MORCEAU_CACHE_);
  }
  try {
    CacheService.getScriptCache().putAll(morceaux, CONFIG.TECHNIQUE.CACHE_DUREE_SECONDES);
  } catch (erreur) {
    console.warn(`Mise en cache impossible (${cle}) : ${erreur.message}`);
  }
}

/**
 * Relit une valeur écrite par ecrireCacheVolumineux_.
 * @param {string} cle Clé lisible.
 * @return {?Object} Valeur, ou null si absente ou incomplète (morceau expiré).
 */
function lireCacheVolumineux_(cle) {
  const cache = CacheService.getScriptCache();
  const prefixe = hacher_(cle);
  const nombre = Number(cache.get(prefixe));
  if (!nombre) return null;
  const cles = Array.from({ length: nombre }, (_, i) => `${prefixe}|${i}`);
  const morceaux = cache.getAll(cles);
  if (cles.some((morceau) => typeof morceaux[morceau] !== 'string')) return null;
  return JSON.parse(cles.map((morceau) => morceaux[morceau]).join(''));
}

/**
 * Rend obsolètes toutes les entrées du cache (après un ajout d'opération
 * ou une actualisation demandée).
 */
function invaliderCache_() {
  versionCacheMemorisee_ = String(Date.now());
  donneesMemorisees_ = null;
  PropertiesService.getScriptProperties()
    .setProperty(CONFIG.TECHNIQUE.PROPRIETE_VERSION_CACHE, versionCacheMemorisee_);
}

/**
 * Version courante du cache (lue une fois par exécution).
 * @return {string} Version.
 */
function lireVersionCache_() {
  if (versionCacheMemorisee_ === null) {
    versionCacheMemorisee_ = PropertiesService.getScriptProperties()
      .getProperty(CONFIG.TECHNIQUE.PROPRIETE_VERSION_CACHE) || '0';
  }
  return versionCacheMemorisee_;
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

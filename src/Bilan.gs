/* -----------------------------------------------------------------------------
 *  Bilan.gs — Calculs du bilan et des synthèses
 *
 *  Rôle : calculs purs à partir d'opérations déjà lues (aucun appel à
 *         SpreadsheetApp) : soldes par compte, détail des non rapprochées,
 *         synthèse par catégorie, vue croisée par exercice.
 *         Les calculs se font en centimes entiers ; les résultats sont
 *         convertis en euros à la fin.
 *  Fonctions principales : calculerSoldesParCompte_, listerNonRapprochees_,
 *         calculerSyntheseParCategorie_, calculerVueCroisee_.
 *  Dépendances : CONFIG (Code.gs), Utils.gs.
 * -------------------------------------------------------------------------- */

/* === Bilan par compte ==================================================== */

/**
 * Soldes par compte, répartis entre opérations rapprochées et non rapprochées.
 * Tous les comptes de la liste apparaissent, même sans opération ; les comptes
 * présents dans les données mais absents de la liste sont ajoutés à la suite.
 * @param {Operation[]} operations Opérations lues.
 * @param {string[]} comptes Comptes de la liste de choix (ordre conservé).
 * @param {{exercice: string, dateFin: string}} filtres exercice vide = tous ;
 *     dateFin AAAA-MM-JJ incluse, vide = sans limite.
 * @return {BilanParCompte} Bilan en euros.
 */
function calculerSoldesParCompte_(operations, comptes, filtres) {
  const retenues = operations.filter((operation) => respecteFiltres_(operation, filtres));
  const cumuls = new Map();
  completerCles_(comptes, retenues.map((operation) => operation.compte))
    .forEach((compte) => cumuls.set(compte, creerCumulCompte_()));
  const total = creerCumulCompte_();
  retenues.forEach((operation) => {
    cumulerCompte_(cumuls.get(operation.compte), operation);
    cumulerCompte_(total, operation);
  });
  return {
    lignes: Array.from(cumuls, ([compte, cumul]) => cumulCompteEnEuros_(compte, cumul)),
    total: cumulCompteEnEuros_('', total)
  };
}

/**
 * Opérations non rapprochées d'un compte, triées par date croissante.
 * @param {Operation[]} operations Opérations lues.
 * @param {string} compte Compte demandé.
 * @param {{exercice: string, dateFin: string}} filtres Mêmes filtres que le bilan.
 * @return {OperationAffichee[]} Opérations à afficher.
 */
function listerNonRapprochees_(operations, compte, filtres) {
  return operations
    .filter((operation) => operation.compte === compte && !operation.estRapproche
      && respecteFiltres_(operation, filtres))
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso) || a.ligne - b.ligne)
    .map((operation) => ({
      ligne: operation.ligne,
      date: operation.dateAffichee,
      qui: operation.qui,
      quoi: operation.quoi,
      moyen: operation.moyen,
      montant: versEuros_(operation.centimes),
      commentaire: operation.commentaire
    }));
}

/* === Synthèse par catégorie ============================================== */

/**
 * Synthèse d'un exercice par catégorie, avec comparaison facultative à
 * l'exercice précédent (dans l'ordre de la liste de choix).
 * @param {Operation[]} operations Opérations lues.
 * @param {string[]} categories Catégories de la liste de choix.
 * @param {string[]} exercices Exercices de la liste de choix (ordre conservé).
 * @param {{exercice: string, comparer: boolean}} options exercice vide ou
 *     inconnu = dernier exercice de la liste.
 * @return {SyntheseParCategorie} Synthèse en euros.
 */
function calculerSyntheseParCategorie_(operations, categories, exercices, options) {
  const exercice = exercices.includes(options.exercice) ? options.exercice : exercices[exercices.length - 1] || '';
  const position = exercices.indexOf(exercice);
  const exercicePrecedent = options.comparer && position > 0 ? exercices[position - 1] : null;
  const delExercice = operations.filter((operation) => operation.exercice === exercice);
  const cumuls = cumulerParCategorie_(delExercice, categories);
  const totaux = totaliserCategories_(cumuls);
  const precedents = exercicePrecedent === null ? null : cumulerParCategorie_(
    operations.filter((operation) => operation.exercice === exercicePrecedent), categories);
  const lignes = Array.from(cumuls, ([categorie, cumul]) =>
    construireLigneSynthese_(categorie, cumul, totaux, precedents));
  lignes.sort((a, b) => b.solde - a.solde || a.categorie.localeCompare(b.categorie));
  return {
    exercice,
    exercicePrecedent,
    lignes,
    totaux: totauxEnEuros_(totaux),
    nonRapprochees: compterNonRapprochees_(delExercice)
  };
}

/**
 * Tableau croisé : soldes par catégorie (lignes) et par exercice (colonnes).
 * Les opérations sans exercice sont regroupées dans une dernière colonne au
 * libellé vide, pour que les totaux restent complets.
 * @param {Operation[]} operations Opérations lues.
 * @param {string[]} categories Catégories de la liste de choix.
 * @param {string[]} exercices Exercices de la liste de choix.
 * @return {VueCroisee} Vue croisée en euros.
 */
function calculerVueCroisee_(operations, categories, exercices) {
  const colonnes = completerCles_(exercices, operations.map((operation) => operation.exercice));
  const parExercice = colonnes.map((exercice) => cumulerParCategorie_(
    operations.filter((operation) => operation.exercice === exercice), categories));
  const lignesCategories = completerCles_(categories,
    operations.map((operation) => libelleCategorie_(operation.categorie)));
  return {
    exercices: colonnes,
    lignes: lignesCategories.map((categorie) => ({
      categorie,
      soldes: parExercice.map((cumuls) => versEuros_(soldeDe_(cumuls.get(categorie))))
    })),
    totaux: parExercice.map((cumuls) => versEuros_(totaliserCategories_(cumuls).solde))
  };
}

/* === Fonctions internes : filtres et clés ================================ */

/**
 * Indique si une opération respecte les filtres exercice et date de fin.
 * Une opération sans date valide n'est pas exclue par la date de fin.
 * @param {Operation} operation Opération.
 * @param {{exercice: string, dateFin: string}} filtres Filtres.
 * @return {boolean} Vrai si l'opération est retenue.
 */
function respecteFiltres_(operation, filtres) {
  const { exercice, dateFin } = filtres;
  if (exercice && operation.exercice !== exercice) return false;
  return !dateFin || !operation.dateIso || operation.dateIso <= dateFin;
}

/**
 * Complète une liste de référence par les valeurs rencontrées hors liste
 * (non vides, triées), pour ne perdre aucune opération historique.
 * @param {string[]} reference Valeurs de la liste de choix (ordre conservé).
 * @param {string[]} rencontrees Valeurs présentes dans les données.
 * @return {string[]} Liste complétée, sans doublon.
 */
function completerCles_(reference, rencontrees) {
  const connues = new Set(reference);
  const supplementaires = Array.from(new Set(rencontrees))
    .filter((valeur) => valeur !== '' && !connues.has(valeur))
    .sort((a, b) => a.localeCompare(b, CONFIG.APP.LOCALE));
  const resultat = reference.concat(supplementaires);
  // Une opération sans compte doit rester visible dans le bilan.
  if (rencontrees.includes('') && !connues.has('')) resultat.push('');
  return resultat;
}

/**
 * Libellé de catégorie d'une opération (« Non catégorisé » si vide).
 * @param {string} categorie Catégorie lue.
 * @return {string} Libellé.
 */
function libelleCategorie_(categorie) {
  return categorie || CONFIG.AFFICHAGE.LIBELLE_SANS_CATEGORIE;
}

/* === Fonctions internes : cumuls par compte ============================== */

/**
 * @return {{rapproche: number, nonRapproche: number, nbNonRapprochees: number}} Cumul vide (centimes).
 */
function creerCumulCompte_() {
  return { rapproche: 0, nonRapproche: 0, nbNonRapprochees: 0 };
}

/**
 * Ajoute une opération au cumul d'un compte.
 * @param {{rapproche: number, nonRapproche: number, nbNonRapprochees: number}} cumul Cumul modifié.
 * @param {Operation} operation Opération à ajouter.
 */
function cumulerCompte_(cumul, operation) {
  if (operation.estRapproche) {
    cumul.rapproche += operation.centimes;
  } else {
    cumul.nonRapproche += operation.centimes;
    cumul.nbNonRapprochees += 1;
  }
}

/**
 * Convertit un cumul de compte en ligne de bilan (euros).
 * @param {string} compte Nom du compte.
 * @param {{rapproche: number, nonRapproche: number, nbNonRapprochees: number}} cumul Cumul en centimes.
 * @return {LigneBilan} Ligne de bilan.
 */
function cumulCompteEnEuros_(compte, cumul) {
  return {
    compte,
    rapproche: versEuros_(cumul.rapproche),
    nonRapproche: versEuros_(cumul.nonRapproche),
    total: versEuros_(cumul.rapproche + cumul.nonRapproche),
    nbNonRapprochees: cumul.nbNonRapprochees
  };
}

/* === Fonctions internes : cumuls par catégorie =========================== */

/**
 * Cumule recettes, dépenses et nombre d'opérations par catégorie.
 * @param {Operation[]} operations Opérations d'un exercice.
 * @param {string[]} categories Catégories de la liste (toutes présentes, même à 0).
 * @return {Map<string, {recettes: number, depenses: number, nb: number}>} Cumuls en centimes.
 */
function cumulerParCategorie_(operations, categories) {
  const cles = completerCles_(categories, operations.map((operation) => libelleCategorie_(operation.categorie)));
  const cumuls = new Map(cles.map((categorie) => [categorie, { recettes: 0, depenses: 0, nb: 0 }]));
  operations.forEach((operation) => {
    const cumul = cumuls.get(libelleCategorie_(operation.categorie));
    if (operation.centimes > 0) cumul.recettes += operation.centimes;
    else cumul.depenses -= operation.centimes;
    cumul.nb += 1;
  });
  return cumuls;
}

/**
 * Solde d'un cumul de catégorie (0 si la catégorie est absente).
 * @param {{recettes: number, depenses: number}|undefined} cumul Cumul en centimes.
 * @return {number} Solde en centimes.
 */
function soldeDe_(cumul) {
  return cumul ? cumul.recettes - cumul.depenses : 0;
}

/**
 * Totaux d'un ensemble de catégories.
 * @param {Map<string, {recettes: number, depenses: number, nb: number}>} cumuls Cumuls en centimes.
 * @return {{recettes: number, depenses: number, solde: number, nb: number}} Totaux en centimes.
 */
function totaliserCategories_(cumuls) {
  const totaux = { recettes: 0, depenses: 0, solde: 0, nb: 0 };
  cumuls.forEach((cumul) => {
    totaux.recettes += cumul.recettes;
    totaux.depenses += cumul.depenses;
    totaux.nb += cumul.nb;
  });
  totaux.solde = totaux.recettes - totaux.depenses;
  return totaux;
}

/**
 * Construit une ligne de synthèse. Une catégorie au solde positif ou nul est
 * une catégorie de recettes : sa part est calculée sur le total des recettes ;
 * sinon sur le total des dépenses.
 * @param {string} categorie Libellé.
 * @param {{recettes: number, depenses: number, nb: number}} cumul Cumul en centimes.
 * @param {{recettes: number, depenses: number}} totaux Totaux de l'exercice en centimes.
 * @param {?Map} precedents Cumuls de l'exercice précédent, ou null.
 * @return {LigneSynthese} Ligne en euros.
 */
function construireLigneSynthese_(categorie, cumul, totaux, precedents) {
  const solde = soldeDe_(cumul);
  const nature = solde >= 0 ? 'RECETTE' : 'DEPENSE';
  const [part, base] = nature === 'RECETTE' ? [cumul.recettes, totaux.recettes] : [cumul.depenses, totaux.depenses];
  const soldePrecedent = precedents ? soldeDe_(precedents.get(categorie)) : null;
  return {
    categorie,
    recettes: versEuros_(cumul.recettes),
    depenses: versEuros_(cumul.depenses),
    solde: versEuros_(solde),
    nbOperations: cumul.nb,
    nature,
    pourcentage: base === 0 ? 0 : Math.round((part / base) * 1000) / 10,
    soldePrecedent: soldePrecedent === null ? null : versEuros_(soldePrecedent),
    ecart: soldePrecedent === null ? null : versEuros_(solde - soldePrecedent)
  };
}

/**
 * Convertit les totaux d'un exercice en euros.
 * @param {{recettes: number, depenses: number, solde: number, nb: number}} totaux Totaux en centimes.
 * @return {{recettes: number, depenses: number, resultat: number, nbOperations: number}} Totaux en euros.
 */
function totauxEnEuros_(totaux) {
  return {
    recettes: versEuros_(totaux.recettes),
    depenses: versEuros_(totaux.depenses),
    resultat: versEuros_(totaux.solde),
    nbOperations: totaux.nb
  };
}

/**
 * Nombre et montant cumulé (signé) des opérations non rapprochées.
 * @param {Operation[]} operations Opérations d'un exercice.
 * @return {{nombre: number, montant: number}} Montant en euros.
 */
function compterNonRapprochees_(operations) {
  const nonRapprochees = operations.filter((operation) => !operation.estRapproche);
  const centimes = nonRapprochees.reduce((somme, operation) => somme + operation.centimes, 0);
  return { nombre: nonRapprochees.length, montant: versEuros_(centimes) };
}

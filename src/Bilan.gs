/* -----------------------------------------------------------------------------
 *  Bilan.gs — Calculs du bilan et des synthèses
 *
 *  Rôle : calculs purs à partir d'opérations déjà lues (aucun appel à
 *         SpreadsheetApp) : soldes par compte, détail des non rapprochées,
 *         synthèse par catégorie, vue croisée, par exercice ou par
 *         année civile (année de la date de l'opération), suivi du budget
 *         prévisionnel. Les calculs se font en centimes entiers ; les
 *         résultats sont convertis en euros à la fin.
 *  Fonctions principales : calculerSoldesParCompte_, listerNonRapprochees_,
 *         calculerSyntheseParCategorie_, calculerVueCroisee_,
 *         calculerSuiviBudgets_, ventilerDepassements_, listerAnnees_.
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
      date: operation.dateIso ? isoVersAffichage_(operation.dateIso) : '',
      qui: operation.qui,
      quoi: operation.quoi,
      moyen: operation.moyen,
      montant: versEuros_(operation.centimes),
      commentaire: operation.commentaire
    }));
}

/* === Synthèse par catégorie ============================================== */

/**
 * Synthèse d'une période (exercice ou année civile) par catégorie, avec
 * comparaison facultative à la période précédente (dans l'ordre de la liste).
 * @param {Operation[]} operations Opérations lues.
 * @param {string[]} categories Catégories de la liste de choix.
 * @param {string[]} periodes Périodes disponibles, dans l'ordre (exercices de
 *     la liste de choix, ou années présentes dans les données).
 * @param {{periode: string, comparer: boolean, regroupement: string}} options
 *     periode vide ou inconnue = dernière période de la liste ; regroupement
 *     'EXERCICE' (défaut) ou 'ANNEE'.
 * @return {SyntheseParCategorie} Synthèse en euros.
 */
function calculerSyntheseParCategorie_(operations, categories, periodes, options) {
  const regroupement = options.regroupement || REGROUPEMENTS_.EXERCICE;
  const periode = periodes.includes(options.periode) ? options.periode : periodes[periodes.length - 1] || '';
  const position = periodes.indexOf(periode);
  const periodePrecedente = options.comparer && position > 0 ? periodes[position - 1] : null;
  const deLaPeriode = filtrerParPeriode_(operations, regroupement, periode);
  const cumuls = cumulerParCategorie_(deLaPeriode, categories);
  const totaux = totaliserCategories_(cumuls);
  const precedents = periodePrecedente === null ? null : cumulerParCategorie_(
    filtrerParPeriode_(operations, regroupement, periodePrecedente), categories);
  const lignes = Array.from(cumuls, ([categorie, cumul]) =>
    construireLigneSynthese_(categorie, cumul, totaux, precedents));
  lignes.sort((a, b) => b.solde - a.solde || a.categorie.localeCompare(b.categorie));
  return {
    regroupement,
    periode,
    periodePrecedente,
    lignes,
    totaux: totauxEnEuros_(totaux),
    nonRapprochees: compterNonRapprochees_(deLaPeriode)
  };
}

/**
 * Tableau croisé : soldes par catégorie (lignes) et par période (colonnes).
 * Les opérations sans période (exercice vide, ou date absente pour les années)
 * sont regroupées dans une dernière colonne au libellé vide, pour que les
 * totaux restent complets.
 * @param {Operation[]} operations Opérations lues.
 * @param {string[]} categories Catégories de la liste de choix.
 * @param {string[]} periodes Périodes disponibles, dans l'ordre.
 * @param {string} [regroupement] 'EXERCICE' (défaut) ou 'ANNEE'.
 * @return {VueCroisee} Vue croisée en euros.
 */
function calculerVueCroisee_(operations, categories, periodes, regroupement = REGROUPEMENTS_.EXERCICE) {
  const colonnes = completerCles_(periodes, operations.map((operation) => periodeDe_(operation, regroupement)));
  const parPeriode = colonnes.map((periode) => cumulerParCategorie_(
    filtrerParPeriode_(operations, regroupement, periode), categories));
  const lignesCategories = completerCles_(categories,
    operations.map((operation) => libelleCategorie_(operation.categorie)));
  return {
    regroupement,
    periodes: colonnes,
    lignes: lignesCategories.map((categorie) => ({
      categorie,
      soldes: parPeriode.map((cumuls) => versEuros_(soldeDe_(cumuls.get(categorie))))
    })),
    totaux: parPeriode.map((cumuls) => versEuros_(totaliserCategories_(cumuls).solde))
  };
}

/* === Suivi du budget prévisionnel ======================================== */

/** Statuts d'une enveloppe budgétaire. */
const STATUTS_BUDGET_ = Object.freeze({ OK: 'OK', ALERTE: 'ALERTE', DEPASSE: 'DEPASSE' });

/**
 * Consommation des enveloppes budgétaires sur un exercice. Le consommé d'une
 * enveloppe est le montant net dépensé dans sa catégorie (dépenses − recettes).
 * Chaque ligne porte aussi sa version « ventilée » (voir ventilerDepassements_),
 * que le navigateur affiche à la demande.
 * @param {Operation[]} operations Opérations lues.
 * @param {{categorie: string, montant: number}[]} enveloppes Budgets en euros (CONFIG.BUDGET.ENVELOPPES).
 * @param {string[]} exercices Exercices de la liste de choix, dans l'ordre.
 * @param {string[]} categories Catégories de la liste de choix.
 * @param {{exercice: string, seuilAlerte: number}} options exercice vide = dernier
 *     de la liste ; seuilAlerte = part consommée (%) déclenchant l'alerte.
 * @return {SuiviBudgets} Suivi en euros.
 */
function calculerSuiviBudgets_(operations, enveloppes, exercices, categories, options) {
  const exercice = options.exercice || exercices[exercices.length - 1] || '';
  const cumuls = cumulerParCategorie_(filtrerParPeriode_(operations, REGROUPEMENTS_.EXERCICE, exercice), categories);
  const postes = enveloppes.map(({ categorie, montant }) => ({
    categorie,
    budget: versCentimes_(montant),
    consomme: -soldeDe_(cumuls.get(categorie)),
    nb: cumuls.has(categorie) ? cumuls.get(categorie).nb : 0
  }));
  const ventilation = ventilerDepassements_(postes);
  const lignes = postes.map((poste, i) => {
    const { recu, cede } = ventilation.parPoste[i];
    const ventilee = construireLigneBudget_(poste.categorie, poste.budget, poste.consomme + recu - cede, poste.nb,
      options.seuilAlerte);
    return Object.assign(construireLigneBudget_(poste.categorie, poste.budget, poste.consomme, poste.nb,
      options.seuilAlerte), {
      ventilation: {
        recu: versEuros_(recu),
        cede: versEuros_(cede),
        consomme: ventilee.consomme,
        reste: ventilee.reste,
        pourcentage: ventilee.pourcentage,
        statut: ventilee.statut
      }
    });
  });
  const somme = (cle) => postes.reduce((total, poste) => total + poste[cle], 0);
  return {
    exercice,
    lignes,
    totaux: construireLigneBudget_('', somme('budget'), somme('consomme'), somme('nb'), options.seuilAlerte),
    depassementNonCouvert: versEuros_(ventilation.nonCouvert),
    categoriesHorsListe: enveloppes.map((enveloppe) => enveloppe.categorie)
      .filter((categorie) => !categories.includes(categorie))
  };
}

/**
 * Reporte les dépassements d'enveloppes sur les enveloppes non dépassées, au
 * prorata de leur budget. Une enveloppe n'absorbe jamais plus que son reste :
 * l'excédent est réparti à nouveau sur celles qui ont encore de la marge.
 * Ce qui ne peut être absorbé reste à la charge des enveloppes dépassées.
 * @param {{budget: number, consomme: number}[]} postes Montants en centimes.
 * @return {{parPoste: {recu: number, cede: number}[], nonCouvert: number}}
 *     recu = dépassement absorbé, cede = dépassement reporté ailleurs (centimes).
 */
function ventilerDepassements_(postes) {
  const depassements = postes.map((poste) => Math.max(poste.consomme - poste.budget, 0));
  const capacites = postes.map((poste, i) => (depassements[i] > 0 ? 0 : Math.max(poste.budget - poste.consomme, 0)));
  const recus = postes.map(() => 0);
  const total = depassements.reduce((somme, montant) => somme + montant, 0);
  let aRepartir = total;
  let actifs = postes.map((poste, i) => i).filter((i) => capacites[i] > 0);
  // Chaque passage répartit tout ou sature au moins une enveloppe : la boucle se termine.
  while (aRepartir > 0 && actifs.length > 0) {
    const parts = repartirAuProrata_(aRepartir, actifs.map((i) => postes[i].budget));
    aRepartir = 0;
    actifs.forEach((i, rang) => {
      const absorbe = Math.min(parts[rang], capacites[i] - recus[i]);
      recus[i] += absorbe;
      aRepartir += parts[rang] - absorbe;
    });
    actifs = actifs.filter((i) => recus[i] < capacites[i]);
  }
  const cedes = repartirAuProrata_(total - aRepartir, depassements);
  return {
    parPoste: postes.map((poste, i) => ({ recu: recus[i], cede: cedes[i] })),
    nonCouvert: aRepartir
  };
}

/**
 * Partage un montant entier au prorata de poids, sans perte de centime
 * (méthode du plus fort reste).
 * @param {number} montant Montant en centimes (≥ 0).
 * @param {number[]} poids Poids positifs ou nuls.
 * @return {number[]} Parts entières, de somme égale au montant (zéros si poids nuls).
 */
function repartirAuProrata_(montant, poids) {
  const totalPoids = poids.reduce((somme, valeur) => somme + valeur, 0);
  if (totalPoids === 0) return poids.map(() => 0);
  const exactes = poids.map((valeur) => (montant * valeur) / totalPoids);
  const parts = exactes.map(Math.floor);
  let reste = montant - parts.reduce((somme, part) => somme + part, 0);
  exactes.map((valeur, i) => ({ i, fraction: valeur - parts[i] }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i)
    .forEach(({ i }) => {
      if (reste > 0) { parts[i] += 1; reste -= 1; }
    });
  return parts;
}

/**
 * @param {string} categorie Catégorie de l'enveloppe ('' pour le total).
 * @param {number} budget Budget en centimes.
 * @param {number} consomme Montant net dépensé en centimes.
 * @param {number} nbOperations Nombre d'opérations de la catégorie.
 * @param {number} seuilAlerte Seuil d'alerte en %.
 * @return {LigneBudget} Ligne en euros.
 */
function construireLigneBudget_(categorie, budget, consomme, nbOperations, seuilAlerte) {
  const pourcentage = budget === 0 ? 0 : Math.round((consomme / budget) * 1000) / 10;
  let statut = STATUTS_BUDGET_.OK;
  if (consomme > budget) statut = STATUTS_BUDGET_.DEPASSE;
  else if (pourcentage >= seuilAlerte) statut = STATUTS_BUDGET_.ALERTE;
  return {
    categorie,
    budget: versEuros_(budget),
    consomme: versEuros_(consomme),
    reste: versEuros_(budget - consomme),
    pourcentage,
    nbOperations,
    statut
  };
}

/**
 * Années civiles présentes dans les opérations datées, par ordre croissant.
 * @param {Operation[]} operations Opérations lues.
 * @return {string[]} Années (AAAA).
 */
function listerAnnees_(operations) {
  return Array.from(new Set(operations.map((operation) => periodeDe_(operation, REGROUPEMENTS_.ANNEE))))
    .filter((annee) => annee !== '')
    .sort();
}

/* === Fonctions internes : périodes ======================================= */

/** Modes de regroupement de la synthèse. */
const REGROUPEMENTS_ = Object.freeze({ EXERCICE: 'EXERCICE', ANNEE: 'ANNEE' });

/**
 * Période d'une opération : son exercice, ou l'année civile de sa date.
 * @param {Operation} operation Opération.
 * @param {string} regroupement 'EXERCICE' ou 'ANNEE'.
 * @return {string} Période ('' si non renseignée ou date invalide).
 */
function periodeDe_(operation, regroupement) {
  if (regroupement === REGROUPEMENTS_.ANNEE) return operation.dateIso ? operation.dateIso.slice(0, 4) : '';
  return operation.exercice;
}

/**
 * @param {Operation[]} operations Opérations lues.
 * @param {string} regroupement 'EXERCICE' ou 'ANNEE'.
 * @param {string} periode Période recherchée.
 * @return {Operation[]} Opérations de la période.
 */
function filtrerParPeriode_(operations, regroupement, periode) {
  return operations.filter((operation) => periodeDe_(operation, regroupement) === periode);
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
 * @param {Operation[]} operations Opérations d'une période.
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
 * @param {{recettes: number, depenses: number}} totaux Totaux de la période en centimes.
 * @param {?Map} precedents Cumuls de la période précédente, ou null.
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
 * Convertit les totaux d'une période en euros.
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
 * @param {Operation[]} operations Opérations d'une période.
 * @return {{nombre: number, montant: number}} Montant en euros.
 */
function compterNonRapprochees_(operations) {
  const nonRapprochees = operations.filter((operation) => !operation.estRapproche);
  const centimes = nonRapprochees.reduce((somme, operation) => somme + operation.centimes, 0);
  return { nombre: nonRapprochees.length, montant: versEuros_(centimes) };
}

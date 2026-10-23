/* -----------------------------------------------------------------------------
 *  Tests.gs — Tests des fonctions métier
 *
 *  Rôle : vérifier Bilan.gs, Operations.gs, Pointage.gs et la lecture d'une ligne sur des
 *         jeux de données en mémoire (le Sheet n'est ni lu ni modifié).
 *  Utilisation : dans l'éditeur Apps Script, sélectionner « lancerTests »
 *         puis Exécuter ; le compte rendu s'affiche dans le journal d'exécution.
 *  Dépendances : Bilan.gs, Operations.gs, Pointage.gs, Donnees.gs, Utils.gs.
 * -------------------------------------------------------------------------- */

/**
 * Lance tous les tests et affiche un compte rendu dans le journal d'exécution.
 * @return {boolean} Vrai si tous les tests réussissent.
 */
function lancerTests() {
  const tests = [
    testerSommesRapprocheNonRapproche_, testerMontantsNegatifsEtTotal_, testerFiltresBilan_,
    testerComptesSansOperation_, testerDetailNonRapprochees_, testerLignesInvalidesIgnorees_, testerFeuilleBudget_,
    testerSyntheseCategorieVide_, testerSyntheseTotaux_, testerComparaisonExercicePrecedent_,
    testerVueCroisee_, testerListerAnnees_, testerSyntheseParAnnee_, testerVueCroiseeParAnnee_,
    testerSuiviBudgets_, testerStatutsBudget_, testerVentilationBudgets_, testerRepartitionProrata_,
    testerPreparerPointage_, testerValiderPointage_, testerPointagePerime_, testerPointageTousComptes_,
    testerSaisieValide_, testerChampsObligatoires_, testerValeursHorsListe_,
    testerDates_, testerMontants_, testerLongueurs_, testerNeutralisationFormules_, testerCentimes_
  ];
  const echecs = [];
  tests.forEach((test) => {
    try {
      test();
      console.log(`✓ ${test.name}`);
    } catch (erreur) {
      echecs.push(test.name);
      console.error(`✗ ${test.name} : ${erreur.message}`);
    }
  });
  console.log(`${tests.length - echecs.length}/${tests.length} tests réussis.`);
  return echecs.length === 0;
}

/* === Outils de test ====================================================== */

/**
 * Vérifie l'égalité de deux valeurs (comparaison JSON).
 * @param {*} obtenu Valeur calculée.
 * @param {*} attendu Valeur attendue.
 * @param {string} libelle Description de la vérification.
 * @throws {Error} Si les valeurs diffèrent.
 */
function verifierEgal_(obtenu, attendu, libelle) {
  const [texteObtenu, texteAttendu] = [JSON.stringify(obtenu), JSON.stringify(attendu)];
  if (texteObtenu !== texteAttendu) throw new Error(`${libelle} : attendu ${texteAttendu}, obtenu ${texteObtenu}`);
}

/**
 * Vérifie qu'un traitement lève une erreur dont le message contient un texte.
 * @param {function(): *} traitement Traitement à exécuter.
 * @param {string} extrait Texte attendu dans le message.
 * @param {string} libelle Description de la vérification.
 * @throws {Error} Si aucune erreur n'est levée ou si le message diffère.
 */
function verifierErreur_(traitement, extrait, libelle) {
  let message = null;
  try {
    traitement();
  } catch (erreur) {
    message = erreur.message;
  }
  if (message === null || !message.includes(extrait)) {
    throw new Error(`${libelle} : erreur contenant « ${extrait} » attendue, obtenu ${JSON.stringify(message)}`);
  }
}

/**
 * Crée une opération de test.
 * @param {Object} valeurs Propriétés à surcharger.
 * @return {Operation} Opération complète.
 */
function operationTest_(valeurs) {
  return Object.assign({
    ligne: 2, compte: 'Banque', dateIso: '2026-01-15', qui: 'Membre',
    quoi: 'Cotisation', moyen: 'Virement', centimes: 1000, exercice: '2026', estRapproche: true,
    categorie: 'Cotisations', commentaire: ''
  }, valeurs);
}

/** Jeu d'opérations commun aux tests du bilan et des synthèses. */
function jeuOperations_() {
  return [
    operationTest_({ ligne: 2, centimes: 10000, estRapproche: true }),
    operationTest_({ ligne: 3, centimes: -2550, estRapproche: false, categorie: 'Achats jeux', dateIso: '2026-02-01' }),
    operationTest_({ ligne: 4, centimes: 1, estRapproche: false, compte: 'Caisse', categorie: '' }),
    operationTest_({ ligne: 5, centimes: 5000, exercice: '2025', dateIso: '2025-06-01' }),
    operationTest_({ ligne: 6, centimes: -1999, estRapproche: false, dateIso: '2026-01-10', categorie: 'Achats jeux' })
  ];
}

/** Listes de choix utilisées par les tests de saisie. */
function listesTest_() {
  return {
    COMPTE: ['Banque', 'Caisse'],
    MOYEN: ['Virement', 'Chèque', 'Espèces'],
    EXERCICE: ['2025', '2026'],
    CATEGORIE: ['Cotisations', 'Achats jeux']
  };
}

/**
 * Saisie valide de référence.
 * @param {Object} [valeurs] Propriétés à surcharger.
 * @return {SaisieOperation} Saisie.
 */
function saisieTest_(valeurs) {
  return Object.assign({
    COMPTE: 'Banque', QUAND: '2026-10-17', QUI: 'Fournisseur', QUOI: 'Achat de jeux', MOYEN: 'Chèque',
    COMBIEN: '-12,50', EXERCICE: '2026', CATEGORIE: 'Achats jeux',
    COMMENTAIRE: ''
  }, valeurs || {});
}

/* === Bilan par compte ==================================================== */

function testerSommesRapprocheNonRapproche_() {
  const bilan = calculerSoldesParCompte_(jeuOperations_(), ['Banque', 'Caisse'], { exercice: '', dateFin: '' });
  const banque = bilan.lignes[0];
  verifierEgal_(banque.rapproche, 150, 'Rapproché Banque');
  verifierEgal_(banque.nonRapproche, -45.49, 'Non rapproché Banque');
  verifierEgal_(banque.total, 104.51, 'Solde Banque = rapproché + non rapproché');
  verifierEgal_(banque.nbNonRapprochees, 2, 'Nombre non rapprochées Banque');
}

function testerMontantsNegatifsEtTotal_() {
  const bilan = calculerSoldesParCompte_(jeuOperations_(), ['Banque', 'Caisse'], { exercice: '', dateFin: '' });
  verifierEgal_(bilan.lignes[1].total, 0.01, 'Solde Caisse');
  verifierEgal_(bilan.total.total, 104.52, 'Total général');
  verifierEgal_(bilan.total.nbNonRapprochees, 3, 'Total non rapprochées');
}

function testerFiltresBilan_() {
  const parExercice = calculerSoldesParCompte_(jeuOperations_(), ['Banque'], { exercice: '2025', dateFin: '' });
  verifierEgal_(parExercice.total.total, 50, 'Filtre exercice 2025');
  const parDate = calculerSoldesParCompte_(jeuOperations_(), ['Banque'], { exercice: '', dateFin: '2026-01-14' });
  verifierEgal_(parDate.total.total, 30.01, 'Filtre date de fin (incluse)');
}

function testerComptesSansOperation_() {
  const bilan = calculerSoldesParCompte_([], ['Banque', 'Livret'], { exercice: '', dateFin: '' });
  verifierEgal_(bilan.lignes.map((ligne) => [ligne.compte, ligne.total]), [['Banque', 0], ['Livret', 0]],
    'Comptes sans opération à 0');
  const horsListe = calculerSoldesParCompte_([operationTest_({ compte: 'Ancien compte' })], ['Banque'],
    { exercice: '', dateFin: '' });
  verifierEgal_(horsListe.lignes.map((ligne) => ligne.compte), ['Banque', 'Ancien compte'], 'Compte hors liste ajouté');
}

function testerDetailNonRapprochees_() {
  const detail = listerNonRapprochees_(jeuOperations_(), 'Banque', { exercice: '', dateFin: '' });
  verifierEgal_(detail.map((operation) => operation.ligne), [6, 3], 'Non rapprochées triées par date');
  verifierEgal_(detail[0].montant, -19.99, 'Montant en euros');
  verifierEgal_(detail[0].date, '10/01/2026', 'Date au format d\'affichage');
}

function testerLignesInvalidesIgnorees_() {
  const index = { COMPTE: 0, QUAND: 1, QUI: 2, QUOI: 3, MOYEN: 4, COMBIEN: 5, EXERCICE: 6, RAPPROCHE: 7,
    CATEGORIE: 8, COMMENTAIRE: 9 };
  const ligne = ['Banque', '', 'X', 'Y', 'Chèque', 'douze', '2026', '', '', ''];
  verifierEgal_(convertirLigneEnOperation_(ligne, index, 45), null, 'Montant texte ignoré');
  verifierEgal_(convertirLigneEnOperation_(ligne.map((v, i) => (i === 5 ? '' : v)), index, 46), null,
    'Montant vide ignoré');
  const valide = convertirLigneEnOperation_(ligne.map((v, i) => (i === 5 ? -3.3 : v)), index, 47);
  verifierEgal_([valide.centimes, valide.estRapproche, valide.dateIso], [-330, false, ''],
    'Ligne valide : centimes, Rapproché vide = FAUX, date absente');
  verifierEgal_(estLigneVide_(['', false, '', null]), true, 'Ligne vide (case décochée) ignorée');
  verifierEgal_([estVrai_(null), estVrai_(undefined), estVrai_(''), estVrai_(false), estVrai_(true)],
    [false, false, false, false, true], 'Rapproché : null, absent ou vide = FAUX');
  const rapprocheNull = convertirLigneEnOperation_(ligne.map((v, i) => (i === 5 ? 1 : (i === 7 ? null : v))), index, 48);
  verifierEgal_(rapprocheNull.estRapproche, false, 'Ligne avec Rapproché null = non rapprochée');
}

/* === Synthèse par catégorie ============================================== */

/** Tableau placé en B3 : titre au-dessus, ligne de total après une ligne vide. */
function testerFeuilleBudget_() {
  const valeurs = [
    ['', 'Budget 2026', ''],
    ['', '', ''],
    ['', ' catégorie ', 'Montant prévu'],
    ['', 'Assurance', 200],
    ['', 'Divers', '50 €'],
    ['', '', 30],
    ['', 'Assurance', 100],
    ['', 'Fournitures', 0],
    ['', 'Achat Jeux', 1000],
    ['', '', ''],
    ['', 'Total', 1200]
  ];
  verifierEgal_(analyserFeuilleBudget_(valeurs, 'Budget'), {
    enveloppes: [{ categorie: 'Assurance', montant: 200 }, { categorie: 'Achat Jeux', montant: 1000 }],
    lignesIgnorees: [5, 6, 7, 8]
  }, 'Enveloppes lues, lignes invalides signalées, arrêt à la ligne vide');
  verifierErreur_(() => analyserFeuilleBudget_([['Catégorie', 'Montant']], 'Budget'), 'Montant Prévu',
    'En-tête manquant signalé');
}

function testerSyntheseCategorieVide_() {
  const synthese = calculerSyntheseParCategorie_(jeuOperations_(), ['Cotisations', 'Achats jeux', 'Dons'],
    ['2025', '2026'], { periode: '2026', comparer: false });
  const parCategorie = {};
  synthese.lignes.forEach((ligne) => { parCategorie[ligne.categorie] = ligne; });
  verifierEgal_(parCategorie[CONFIG.AFFICHAGE.LIBELLE_SANS_CATEGORIE].solde, 0.01, 'Catégorie vide → Non catégorisé');
  verifierEgal_(parCategorie.Dons.nbOperations, 0, 'Catégorie sans opération présente');
  verifierEgal_(synthese.lignes.map((ligne) => ligne.categorie)[0], 'Cotisations', 'Tri par solde décroissant');
}

function testerSyntheseTotaux_() {
  const synthese = calculerSyntheseParCategorie_(jeuOperations_(), ['Cotisations', 'Achats jeux'],
    ['2025', '2026'], { periode: '', comparer: false });
  verifierEgal_(synthese.periode, '2026', 'Exercice par défaut = dernier de la liste');
  verifierEgal_(synthese.totaux, { recettes: 100.01, depenses: 45.49, resultat: 54.52, nbOperations: 4 },
    'Totaux de l\'exercice');
  const sommeSoldes = synthese.lignes.reduce((somme, ligne) => somme + versCentimes_(ligne.solde), 0);
  verifierEgal_(versEuros_(sommeSoldes), synthese.totaux.resultat, 'Somme des catégories = résultat');
  verifierEgal_(synthese.nonRapprochees, { nombre: 3, montant: -45.48 }, 'Indicateur non rapprochées');
  const achats = synthese.lignes.find((ligne) => ligne.categorie === 'Achats jeux');
  verifierEgal_([achats.nature, achats.pourcentage], ['DEPENSE', 100], 'Part des dépenses');
}

function testerComparaisonExercicePrecedent_() {
  const synthese = calculerSyntheseParCategorie_(jeuOperations_(), ['Cotisations'], ['2025', '2026'],
    { periode: '2026', comparer: true });
  const cotisations = synthese.lignes.find((ligne) => ligne.categorie === 'Cotisations');
  verifierEgal_([synthese.periodePrecedente, cotisations.soldePrecedent, cotisations.ecart], ['2025', 50, 50],
    'Comparaison N-1');
  const premier = calculerSyntheseParCategorie_(jeuOperations_(), ['Cotisations'], ['2025', '2026'],
    { periode: '2025', comparer: true });
  verifierEgal_(premier.periodePrecedente, null, 'Pas de N-1 pour le premier exercice');
  verifierEgal_([premier.soldeGlobal, synthese.soldeGlobal], [104.52, 104.52], 'Solde global indépendant de l\'exercice');
}

function testerVueCroisee_() {
  const vue = calculerVueCroisee_(jeuOperations_(), ['Cotisations', 'Achats jeux'], ['2025', '2026']);
  verifierEgal_(vue.periodes, ['2025', '2026'], 'Colonnes exercices');
  verifierEgal_(vue.lignes[0], { categorie: 'Cotisations', soldes: [50, 100] }, 'Soldes Cotisations');
  verifierEgal_(vue.totaux, [50, 54.52], 'Totaux par exercice');
  verifierEgal_(vue.soldeGlobal, 104.52, 'Solde global de la vue croisée');
}

/** Exercice 2026 commencé en 2025 (ligne 7) et opération sans date (ligne 8). */
function jeuOperationsAnnees_() {
  return jeuOperations_().concat([
    operationTest_({ ligne: 7, centimes: 2000, dateIso: '2025-12-20' }),
    operationTest_({ ligne: 8, centimes: 300, dateIso: '' })
  ]);
}

function testerListerAnnees_() {
  verifierEgal_(listerAnnees_(jeuOperationsAnnees_()), ['2025', '2026'], 'Années distinctes, triées, sans vide');
}

function testerSyntheseParAnnee_() {
  const options = { periode: '2025', comparer: false, regroupement: REGROUPEMENTS_.ANNEE };
  const synthese = calculerSyntheseParCategorie_(jeuOperationsAnnees_(), ['Cotisations'], ['2025', '2026'], options);
  verifierEgal_([synthese.regroupement, synthese.periode], ['ANNEE', '2025'], 'Année demandée');
  verifierEgal_(synthese.totaux, { recettes: 70, depenses: 0, resultat: 70, nbOperations: 2 },
    'Année 2025 = date en 2025, quel que soit l\'exercice');
  const comparee = calculerSyntheseParCategorie_(jeuOperationsAnnees_(), ['Cotisations'], ['2025', '2026'],
    { periode: '2026', comparer: true, regroupement: REGROUPEMENTS_.ANNEE });
  const cotisations = comparee.lignes.find((ligne) => ligne.categorie === 'Cotisations');
  verifierEgal_([comparee.periodePrecedente, cotisations.solde, cotisations.soldePrecedent], ['2025', 100, 70],
    'Comparaison avec l\'année précédente');
}

function testerVueCroiseeParAnnee_() {
  const vue = calculerVueCroisee_(jeuOperationsAnnees_(), ['Cotisations', 'Achats jeux'], ['2025', '2026'],
    REGROUPEMENTS_.ANNEE);
  verifierEgal_(vue.periodes, ['2025', '2026', ''], 'Colonne vide pour les opérations sans date');
  verifierEgal_(vue.lignes[0], { categorie: 'Cotisations', soldes: [70, 100, 3] }, 'Soldes Cotisations par année');
  verifierEgal_(vue.totaux, [70, 54.52, 3], 'Totaux par année');
}

/* === Budget prévisionnel ================================================= */

function testerSuiviBudgets_() {
  const operations = jeuOperations_().concat([
    operationTest_({ ligne: 7, centimes: 500, categorie: 'Achats jeux' }),
    operationTest_({ ligne: 8, centimes: -9900, categorie: 'Achats jeux', exercice: '2025' })
  ]);
  const suivi = calculerSuiviBudgets_(operations, [{ categorie: 'Achats jeux', montant: 300 }],
    ['2025', '2026'], ['Cotisations', 'Achats jeux'], { exercice: '', seuilAlerte: 80 });
  verifierEgal_(suivi.exercice, '2026', 'Exercice par défaut = dernier de la liste');
  const { ventilation, ...ligne } = suivi.lignes[0];
  verifierEgal_(ligne, { categorie: 'Achats jeux', budget: 300, consomme: 40.49, reste: 259.51,
    pourcentage: 13.5, nbOperations: 3, statut: 'OK' }, 'Consommé = dépenses − remboursements de l\'exercice');
  verifierEgal_([ventilation.recu, ventilation.cede, ventilation.consomme], [0, 0, 40.49], 'Aucun dépassement à ventiler');
  verifierEgal_(suivi.categoriesHorsListe, [], 'Catégorie connue');
  const autre = calculerSuiviBudgets_(operations, [{ categorie: 'Achats jeux', montant: 300 }],
    ['2025', '2026'], ['Achats jeux'], { exercice: '2025', seuilAlerte: 80 });
  verifierEgal_(autre.lignes[0].consomme, 99, 'Exercice imposé par la configuration');
  const inconnue = calculerSuiviBudgets_(operations, [{ categorie: 'Achat Jeux', montant: 50 }],
    ['2025', '2026'], ['Achats jeux'], { exercice: '', seuilAlerte: 80 });
  verifierEgal_([inconnue.lignes[0].consomme, inconnue.lignes[0].nbOperations, inconnue.categoriesHorsListe],
    [0, 0, ['Achat Jeux']], 'Catégorie absente de la liste signalée');
}

function testerStatutsBudget_() {
  const suivre = (montants) => calculerSuiviBudgets_(jeuOperations_(),
    montants.map((montant, i) => ({ categorie: i === 0 ? 'Achats jeux' : 'Animations', montant })),
    ['2025', '2026'], ['Cotisations', 'Achats jeux', 'Animations'], { exercice: '', seuilAlerte: 80 });
  verifierEgal_(suivre([100]).lignes[0].statut, 'OK', 'Sous le seuil');
  verifierEgal_(suivre([50]).lignes[0].statut, 'ALERTE', 'Seuil d\'alerte atteint (91 %)');
  const depasse = suivre([40]).lignes[0];
  verifierEgal_([depasse.statut, depasse.reste], ['DEPASSE', -5.49], 'Budget dépassé, reste négatif');
  verifierEgal_(suivre([100, 50]).totaux, { categorie: '', budget: 150, consomme: 45.49, reste: 104.51,
    pourcentage: 30.3, nbOperations: 2, statut: 'OK' }, 'Totaux de toutes les enveloppes');
}

function testerVentilationBudgets_() {
  // Consommés : Achats jeux 45,49 € ; Animations 30 € ; Divers 10 €.
  const operations = jeuOperations_().concat([
    operationTest_({ ligne: 7, centimes: -3000, categorie: 'Animations' }),
    operationTest_({ ligne: 8, centimes: -1000, categorie: 'Divers' })
  ]);
  const suivre = (montants) => calculerSuiviBudgets_(operations,
    ['Achats jeux', 'Animations', 'Divers'].map((categorie, i) => ({ categorie, montant: montants[i] })),
    ['2025', '2026'], ['Achats jeux', 'Animations', 'Divers'], { exercice: '', seuilAlerte: 80 });
  const extraire = (suivi) => suivi.lignes.map(({ ventilation }) =>
    [ventilation.recu, ventilation.cede, ventilation.consomme, ventilation.statut]);
  // Dépassement de 15,49 € réparti 100/300 et 200/300 sur Animations et Divers.
  const prorata = suivre([30, 100, 200]);
  verifierEgal_(extraire(prorata), [[0, 15.49, 30, 'ALERTE'], [5.16, 0, 35.16, 'OK'], [10.33, 0, 20.33, 'OK']],
    'Dépassement réparti au prorata des budgets, sans perte de centime');
  verifierEgal_(prorata.lignes[0].statut, 'DEPASSE', 'Statut sans ventilation inchangé');
  verifierEgal_(prorata.depassementNonCouvert, 0, 'Dépassement entièrement couvert');
  // Animations (marge 2 €) est saturée : le reste du dépassement va sur Divers.
  const plafond = suivre([30, 32, 200]);
  verifierEgal_(extraire(plafond), [[0, 15.49, 30, 'ALERTE'], [2, 0, 32, 'ALERTE'], [13.49, 0, 23.49, 'OK']],
    'Une enveloppe n\'absorbe pas plus que son reste');
  // Marges totales (1 € + 1 €) insuffisantes : 13,49 € restent sur l'enveloppe dépassée.
  const insuffisant = suivre([30, 31, 11]);
  verifierEgal_(extraire(insuffisant), [[0, 2, 43.49, 'DEPASSE'], [1, 0, 31, 'ALERTE'], [1, 0, 11, 'ALERTE']],
    'Dépassement partiellement couvert');
  verifierEgal_(insuffisant.depassementNonCouvert, 13.49, 'Part non couverte signalée');
  verifierEgal_(insuffisant.totaux.consomme, 85.49, 'Totaux inchangés par la ventilation');
}

function testerRepartitionProrata_() {
  verifierEgal_(repartirAuProrata_(100, [1, 1, 1]), [34, 33, 33], 'Plus fort reste, premier servi à égalité');
  verifierEgal_(repartirAuProrata_(7, [0, 0]), [0, 0], 'Poids nuls');
  verifierEgal_(repartirAuProrata_(1549, [100, 200]), [516, 1033], 'Prorata exact au centime');
}

/* === Pointage ============================================================ */

/**
 * Demande de pointage telle qu'envoyée par le navigateur pour le jeu commun.
 * @param {Object[]} [operations] Opérations demandées (défaut : lignes 3 et 6 de Banque).
 * @return {Object} Demande.
 */
function demandePointageTest_(operations) {
  return {
    compte: 'Banque',
    operations: operations || [
      { ligne: 6, dateIso: '2026-01-10', montant: -19.99 },
      { ligne: 3, dateIso: '2026-02-01', montant: -25.5 }
    ]
  };
}

function testerPreparerPointage_() {
  const pointage = preparerPointage_(jeuOperations_(), 'Banque');
  verifierEgal_([pointage.soldes.rapproche, pointage.soldes.nonRapproche, pointage.soldes.total], [150, -45.49, 104.51],
    'Soldes du compte, tous exercices');
  verifierEgal_(pointage.operations.map((operation) => operation.ligne), [6, 3], 'Non rapprochées triées par date');
  verifierEgal_(pointage.operations[0].dateIso, '2026-01-10', 'Date ISO transmise pour le contrôle');
}

function testerValiderPointage_() {
  const resultat = validerPointage_(demandePointageTest_(), jeuOperations_());
  verifierEgal_(resultat, { compte: 'Banque', lignes: [3, 6], montant: -45.49 }, 'Pointage accepté, lignes triées');
  const doublon = demandePointageTest_([{ ligne: 3, dateIso: '2026-02-01', montant: -25.5 },
    { ligne: 3, dateIso: '2026-02-01', montant: -25.5 }]);
  verifierEgal_(validerPointage_(doublon, jeuOperations_()).lignes, [3], 'Ligne en double comptée une fois');
  verifierErreur_(() => validerPointage_(demandePointageTest_([]), jeuOperations_()),
    CONFIG.MESSAGES.POINTAGE_VIDE, 'Demande vide refusée');
}

function testerPointagePerime_() {
  const verifierRefus = (element, libelle) => verifierErreur_(() =>
    validerPointage_(demandePointageTest_([{ ligne: 6, dateIso: '2026-01-10', montant: -19.99 }, element]),
      jeuOperations_()), 'ligne', libelle);
  verifierRefus({ ligne: 3, dateIso: '2026-02-01', montant: -25 }, 'Montant modifié');
  verifierRefus({ ligne: 3, dateIso: '2026-02-02', montant: -25.5 }, 'Date modifiée');
  verifierRefus({ ligne: 2, dateIso: '2026-01-15', montant: 100 }, 'Déjà rapprochée');
  verifierRefus({ ligne: 4, dateIso: '2026-01-15', montant: 0.01 }, 'Autre compte');
  verifierRefus({ ligne: 99, dateIso: '2026-01-15', montant: 1 }, 'Ligne inexistante');
}

function testerPointageTousComptes_() {
  const pointage = preparerPointage_(jeuOperations_(), TOUS_LES_COMPTES_);
  verifierEgal_([pointage.soldes.rapproche, pointage.soldes.nonRapproche], [150, -45.48], 'Soldes de tous les comptes');
  verifierEgal_(pointage.operations.map((operation) => operation.ligne), [6, 4, 3], 'Non rapprochées de tous les comptes');
  verifierEgal_(pointage.operations[1].compte, 'Caisse', 'Compte transmis pour l\'affichage');
  const demande = { compte: TOUS_LES_COMPTES_, operations: [{ ligne: 4, dateIso: '2026-01-15', montant: 0.01 },
    { ligne: 3, dateIso: '2026-02-01', montant: -25.5 }] };
  verifierEgal_(validerPointage_(demande, jeuOperations_()).lignes, [3, 4], 'Pointage sur plusieurs comptes');
  verifierErreur_(() => validerPointage_({ compte: TOUS_LES_COMPTES_,
    operations: [{ ligne: 2, dateIso: '2026-01-15', montant: 100 }] }, jeuOperations_()), 'ligne', 'Déjà rapprochée');
}

/* === Validation de la saisie ============================================= */

function testerSaisieValide_() {
  const resultat = validerOperation_(saisieTest_(), listesTest_(), '2026-10-17');
  verifierEgal_(resultat.estValide, true, 'Saisie valide acceptée');
  verifierEgal_(resultat.operation.COMBIEN, -12.5, 'Dépense → montant négatif');
  const recette = validerOperation_(saisieTest_({ COMBIEN: '1 234.5' }), listesTest_(), '2026-10-17');
  verifierEgal_(recette.operation.COMBIEN, 1234.5, 'Sans signe → recette, point et espace acceptés');
  verifierEgal_(validerOperation_(saisieTest_({ COMBIEN: '+8' }), listesTest_(), '2026-10-17').operation.COMBIEN, 8,
    'Signe + accepté');
}

function testerChampsObligatoires_() {
  const vide = validerOperation_(saisieTest_({ COMPTE: ' ', QUI: '', QUOI: '  ', COMBIEN: '', QUAND: '' }),
    listesTest_(), '2026-10-17');
  verifierEgal_(Object.keys(vide.erreurs).sort(), ['COMBIEN', 'COMPTE', 'QUAND', 'QUI', 'QUOI'], 'Champs vides signalés');
  verifierEgal_(validerOperation_(saisieTest_({ RAPPROCHE: true }), listesTest_(), '2026-10-17').operation.RAPPROCHE,
    false, 'Nouvelle opération toujours non rapprochée');
  verifierEgal_(vide.operation, null, 'Aucune opération si invalide');
  verifierEgal_(validerOperation_(saisieTest_({ COMMENTAIRE: '' }), listesTest_(), '2026-10-17').estValide, true,
    'Commentaire facultatif');
}

function testerValeursHorsListe_() {
  const resultat = validerOperation_(saisieTest_({ COMPTE: 'Pirate', MOYEN: 'Bitcoin', EXERCICE: '1999',
    CATEGORIE: 'Autre' }), listesTest_(), '2026-10-17');
  verifierEgal_(Object.keys(resultat.erreurs).sort(), ['CATEGORIE', 'COMPTE', 'EXERCICE', 'MOYEN'],
    'Valeurs hors liste refusées');
}

function testerDates_() {
  const verifier = (quand) => validerOperation_(saisieTest_({ QUAND: quand }), listesTest_(), '2026-10-17').estValide;
  verifierEgal_(verifier('2026-02-30'), false, 'Date inexistante refusée');
  verifierEgal_(verifier('17/10/2026'), false, 'Format non ISO refusé');
  verifierEgal_(verifier('1999-12-31'), false, 'Date avant DATE_MIN refusée');
  verifierEgal_(verifier('2027-10-17'), true, 'Aujourd\'hui + 365 jours accepté');
  verifierEgal_(verifier('2027-10-18'), false, 'Au-delà de la plage refusé');
}

function testerMontants_() {
  const verifier = (combien) => validerOperation_(saisieTest_({ COMBIEN: combien }), listesTest_(), '2026-10-17');
  verifierEgal_(verifier('0').estValide, false, 'Montant nul refusé');
  verifierEgal_(verifier('-0').estValide, false, 'Montant nul signé refusé');
  verifierEgal_(verifier('--5').estValide, false, 'Double signe refusé');
  verifierEgal_(verifier('abc').estValide, false, 'Montant non numérique refusé');
  verifierEgal_(verifier('0,001').estValide, false, 'Montant arrondi à 0 refusé');
  verifierEgal_(verifier('-10,005').operation.COMBIEN, -10.01, 'Dépense arrondie à 2 décimales (valeur absolue)');
}

function testerLongueurs_() {
  const resultat = validerOperation_(saisieTest_({ QUI: 'x'.repeat(101), QUOI: 'y'.repeat(200),
    COMMENTAIRE: 'z'.repeat(501) }), listesTest_(), '2026-10-17');
  verifierEgal_(Object.keys(resultat.erreurs).sort(), ['COMMENTAIRE', 'QUI'], 'Longueurs maximales');
}

function testerNeutralisationFormules_() {
  const resultat = validerOperation_(saisieTest_({ QUOI: '=HYPERLINK("http://x")', QUI: '+33 6', COMMENTAIRE: '@a' }),
    listesTest_(), '2026-10-17');
  verifierEgal_([resultat.operation.QUOI, resultat.operation.QUI, resultat.operation.COMMENTAIRE],
    ['\'=HYPERLINK("http://x")', '\'+33 6', '\'@a'], 'Formules neutralisées');
}

function testerCentimes_() {
  verifierEgal_(versCentimes_(1.005), 101, 'Arrondi 1,005 €');
  verifierEgal_(versCentimes_(0.1) + versCentimes_(0.2), 30, '0,10 + 0,20 sans erreur de flottant');
  verifierEgal_(versEuros_(-2550), -25.5, 'Centimes vers euros');
}

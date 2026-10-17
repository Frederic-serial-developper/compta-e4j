/* -----------------------------------------------------------------------------
 *  Tests.gs — Tests des fonctions métier
 *
 *  Rôle : vérifier Bilan.gs, Operations.gs et la lecture d'une ligne sur des
 *         jeux de données en mémoire (le Sheet n'est ni lu ni modifié).
 *  Utilisation : dans l'éditeur Apps Script, sélectionner « lancerTests »
 *         puis Exécuter ; le compte rendu s'affiche dans le journal d'exécution.
 *  Dépendances : Bilan.gs, Operations.gs, Donnees.gs, Utils.gs.
 * -------------------------------------------------------------------------- */

/**
 * Lance tous les tests et affiche un compte rendu dans le journal d'exécution.
 * @return {boolean} Vrai si tous les tests réussissent.
 */
function lancerTests() {
  const tests = [
    testerSommesRapprocheNonRapproche_, testerMontantsNegatifsEtTotal_, testerFiltresBilan_,
    testerComptesSansOperation_, testerDetailNonRapprochees_, testerLignesInvalidesIgnorees_,
    testerSyntheseCategorieVide_, testerSyntheseTotaux_, testerComparaisonExercicePrecedent_,
    testerVueCroisee_, testerSaisieValide_, testerChampsObligatoires_, testerValeursHorsListe_,
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

function testerSyntheseCategorieVide_() {
  const synthese = calculerSyntheseParCategorie_(jeuOperations_(), ['Cotisations', 'Achats jeux', 'Dons'],
    ['2025', '2026'], { exercice: '2026', comparer: false });
  const parCategorie = {};
  synthese.lignes.forEach((ligne) => { parCategorie[ligne.categorie] = ligne; });
  verifierEgal_(parCategorie[CONFIG.AFFICHAGE.LIBELLE_SANS_CATEGORIE].solde, 0.01, 'Catégorie vide → Non catégorisé');
  verifierEgal_(parCategorie.Dons.nbOperations, 0, 'Catégorie sans opération présente');
  verifierEgal_(synthese.lignes.map((ligne) => ligne.categorie)[0], 'Cotisations', 'Tri par solde décroissant');
}

function testerSyntheseTotaux_() {
  const synthese = calculerSyntheseParCategorie_(jeuOperations_(), ['Cotisations', 'Achats jeux'],
    ['2025', '2026'], { exercice: '', comparer: false });
  verifierEgal_(synthese.exercice, '2026', 'Exercice par défaut = dernier de la liste');
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
    { exercice: '2026', comparer: true });
  const cotisations = synthese.lignes.find((ligne) => ligne.categorie === 'Cotisations');
  verifierEgal_([synthese.exercicePrecedent, cotisations.soldePrecedent, cotisations.ecart], ['2025', 50, 50],
    'Comparaison N-1');
  const premier = calculerSyntheseParCategorie_(jeuOperations_(), ['Cotisations'], ['2025', '2026'],
    { exercice: '2025', comparer: true });
  verifierEgal_(premier.exercicePrecedent, null, 'Pas de N-1 pour le premier exercice');
}

function testerVueCroisee_() {
  const vue = calculerVueCroisee_(jeuOperations_(), ['Cotisations', 'Achats jeux'], ['2025', '2026']);
  verifierEgal_(vue.exercices, ['2025', '2026'], 'Colonnes exercices');
  verifierEgal_(vue.lignes[0], { categorie: 'Cotisations', soldes: [50, 100] }, 'Soldes Cotisations');
  verifierEgal_(vue.totaux, [50, 54.52], 'Totaux par exercice');
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

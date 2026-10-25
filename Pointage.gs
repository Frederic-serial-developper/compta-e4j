/* -----------------------------------------------------------------------------
 *  Pointage.gs — Pointage (rapprochement) des opérations d'un compte
 *
 *  Rôle : préparer l'écran de pointage d'un compte, ou de tous les comptes
 *         (soldes et opérations non rapprochées), et contrôler une demande de
 *         pointage avant écriture.
 *         Fonctions pures : les opérations sont fournies en paramètre.
 *         Le pointage est « tout ou rien » : si une seule opération demandée
 *         ne correspond plus au Sheet, la demande entière est refusée.
 *  Fonctions principales : preparerPointage_, validerPointage_,
 *         libelleComptePointage_.
 *  Dépendances : CONFIG (Code.gs), Bilan.gs, Utils.gs.
 * -------------------------------------------------------------------------- */

/** Valeur du choix « tous les comptes » (aucun compte de la liste ne peut la porter). */
const TOUS_LES_COMPTES_ = '*';

/**
 * Données de l'écran de pointage d'un compte, tous exercices confondus (le
 * pointage se fait contre un relevé bancaire, cumulatif).
 * @param {Operation[]} operations Opérations lues.
 * @param {string} compte Compte à pointer, ou TOUS_LES_COMPTES_.
 * @return {{compte: string, soldes: LigneBilan, operations: OperationAffichee[]}}
 *     soldes : rapproché / non rapproché / total avant pointage ;
 *     operations : non rapprochées, triées par date croissante.
 */
function preparerPointage_(operations, compte) {
  const cumul = creerCumulCompte_();
  operations.filter((operation) => concerneCompte_(operation, compte))
    .forEach((operation) => cumulerCompte_(cumul, operation));
  return {
    compte,
    soldes: cumulCompteEnEuros_(compte, cumul),
    operations: listerNonRapprochees_(operations, compte === TOUS_LES_COMPTES_ ? null : compte,
      { exercice: '', dateFin: '' })
  };
}

/**
 * Contrôle une demande de pointage sur les opérations relues sous verrou.
 * Chaque opération demandée doit encore exister à la même ligne, sur le même
 * compte (n'importe lequel pour TOUS_LES_COMPTES_), non rapprochée, avec la même date et le même montant : sinon le
 * Sheet a changé depuis l'affichage et rien ne doit être écrit.
 * @param {{compte: string, operations: {ligne: number, dateIso: string, montant: number}[]}} demande
 *     Demande reçue du navigateur (non fiable).
 * @param {Operation[]} operations Opérations relues dans le Sheet.
 * @return {{compte: string, lignes: number[], montant: number}} Lignes à cocher
 *     (croissantes, sans doublon) et montant pointé en euros.
 * @throws {Error} Erreur métier si la demande est vide ou ne correspond plus au Sheet.
 */
function validerPointage_(demande, operations) {
  const compte = texte_(demande && demande.compte);
  const elements = Array.isArray(demande && demande.operations) ? demande.operations : [];
  if (compte === '' || elements.length === 0) throw erreurMetier_(CONFIG.MESSAGES.POINTAGE_VIDE);
  const parLigne = new Map(operations.map((operation) => [operation.ligne, operation]));
  const lignes = new Set();
  let centimes = 0;
  elements.forEach((element) => {
    const ligne = Number(element && element.ligne);
    if (lignes.has(ligne)) return;
    const operation = parLigne.get(ligne);
    if (!correspondAuSheet_(operation, element, compte)) {
      throw erreurMetier_(remplacerVariables_(CONFIG.MESSAGES.POINTAGE_PERIME, { ligne: texte_(element && element.ligne) }));
    }
    lignes.add(ligne);
    centimes += operation.centimes;
  });
  return { compte, lignes: Array.from(lignes).sort((a, b) => a - b), montant: versEuros_(centimes) };
}

/**
 * @param {string} compte Compte pointé, ou TOUS_LES_COMPTES_.
 * @return {string} Libellé pour les messages et le Journal.
 */
function libelleComptePointage_(compte) {
  return compte === TOUS_LES_COMPTES_ ? CONFIG.AFFICHAGE.LIBELLE_TOUS_COMPTES : compte;
}

/* === Fonctions internes ================================================== */

/**
 * @param {Operation} operation Opération lue.
 * @param {string} compte Compte pointé, ou TOUS_LES_COMPTES_.
 * @return {boolean} Vrai si l'opération relève du pointage demandé.
 */
function concerneCompte_(operation, compte) {
  return compte === TOUS_LES_COMPTES_ || operation.compte === compte;
}

/**
 * Indique si une opération relue est bien celle que le navigateur a affichée.
 * @param {Operation|undefined} operation Opération relue à la ligne demandée.
 * @param {{dateIso: string, montant: number}} element Opération telle qu'affichée.
 * @param {string} compte Compte pointé, ou TOUS_LES_COMPTES_.
 * @return {boolean} Vrai si l'opération peut être pointée.
 */
function correspondAuSheet_(operation, element, compte) {
  return Boolean(operation) && concerneCompte_(operation, compte) && !operation.estRapproche
    && operation.dateIso === texte_(element.dateIso)
    && operation.centimes === versCentimes_(Number(element.montant));
}

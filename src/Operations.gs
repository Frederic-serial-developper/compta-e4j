/* -----------------------------------------------------------------------------
 *  Operations.gs — Validation d'une nouvelle opération
 *
 *  Rôle : contrôler et normaliser la saisie du formulaire avant écriture
 *         (champs obligatoires, listes de choix, date, montant, longueurs,
 *         neutralisation des formules). Fonctions pures : les listes et la
 *         date du jour sont fournies en paramètre.
 *  Fonctions principales : validerOperation_.
 *  Dépendances : CONFIG (Code.gs), Utils.gs.
 * -------------------------------------------------------------------------- */

/**
 * Valide et normalise une saisie d'opération.
 * @param {SaisieOperation} saisie Données reçues du navigateur (non fiables).
 * @param {Object<string, string[]>} listes Valeurs autorisées par clé de champ à liste.
 * @param {string} aujourdhui Date du jour AAAA-MM-JJ.
 * @return {{estValide: boolean, erreurs: Object<string, string>, operation: ?OperationValidee}}
 *     erreurs : message par clé de champ ; operation : null si invalide.
 */
function validerOperation_(saisie, listes, aujourdhui) {
  const erreurs = {};
  const operation = {};
  validerChampsListe_(saisie, listes, erreurs, operation);
  validerChampsTexte_(saisie, erreurs, operation);
  validerDate_(saisie.QUAND, aujourdhui, erreurs, operation);
  validerMontant_(saisie, erreurs, operation);
  operation.RAPPROCHE = saisie.RAPPROCHE === true;
  const estValide = Object.keys(erreurs).length === 0;
  return { estValide, erreurs, operation: estValide ? operation : null };
}

/* === Fonctions internes ================================================== */

/**
 * Indique si un champ est obligatoire.
 * @param {string} cle Clé de CONFIG.COLONNES.
 * @return {boolean} Vrai si obligatoire.
 */
function estObligatoire_(cle) {
  return !CONFIG.SAISIE.CHAMPS_FACULTATIFS.includes(cle);
}

/**
 * Contrôle les champs à liste de choix : la valeur doit appartenir à la
 * liste courante (protection contre une requête modifiée).
 * @param {SaisieOperation} saisie Saisie brute.
 * @param {Object<string, string[]>} listes Valeurs autorisées.
 * @param {Object<string, string>} erreurs Erreurs complétées.
 * @param {Object} operation Opération complétée.
 */
function validerChampsListe_(saisie, listes, erreurs, operation) {
  CONFIG.SAISIE.CHAMPS_A_LISTE.forEach((cle) => {
    const valeur = texte_(saisie[cle]);
    if (valeur === '') {
      if (estObligatoire_(cle)) erreurs[cle] = CONFIG.MESSAGES.CHAMP_OBLIGATOIRE;
    } else if (!(listes[cle] || []).includes(valeur)) {
      erreurs[cle] = CONFIG.MESSAGES.VALEUR_HORS_LISTE;
    }
    operation[cle] = valeur;
  });
}

/**
 * Contrôle les champs texte libres (présence, longueur) et neutralise les
 * formules. La longueur est contrôlée sur le texte saisi, avant neutralisation.
 * @param {SaisieOperation} saisie Saisie brute.
 * @param {Object<string, string>} erreurs Erreurs complétées.
 * @param {Object} operation Opération complétée.
 */
function validerChampsTexte_(saisie, erreurs, operation) {
  const longueurs = CONFIG.SAISIE.LONGUEUR_MAX;
  Object.keys(longueurs).forEach((cle) => {
    const valeur = texte_(saisie[cle]);
    if (valeur === '' && estObligatoire_(cle)) {
      erreurs[cle] = CONFIG.MESSAGES.CHAMP_OBLIGATOIRE;
    } else if (valeur.length > longueurs[cle]) {
      erreurs[cle] = remplacerVariables_(CONFIG.MESSAGES.TEXTE_TROP_LONG, { max: longueurs[cle] });
    }
    operation[cle] = neutraliserFormule_(valeur);
  });
}

/**
 * Contrôle la date : format AAAA-MM-JJ, date réelle, comprise entre
 * CONFIG.SAISIE.DATE_MIN et aujourd'hui + DATE_MAX_JOURS_FUTUR.
 * @param {*} saisie Date saisie.
 * @param {string} aujourdhui Date du jour AAAA-MM-JJ.
 * @param {Object<string, string>} erreurs Erreurs complétées.
 * @param {Object} operation Opération complétée.
 */
function validerDate_(saisie, aujourdhui, erreurs, operation) {
  const valeur = texte_(saisie);
  const { DATE_MIN, DATE_MAX_JOURS_FUTUR } = CONFIG.SAISIE;
  const dateMax = ajouterJoursIso_(aujourdhui, DATE_MAX_JOURS_FUTUR);
  operation.QUAND = valeur;
  if (valeur === '') {
    erreurs.QUAND = CONFIG.MESSAGES.CHAMP_OBLIGATOIRE;
  } else if (!parserDateIso_(valeur)) {
    erreurs.QUAND = CONFIG.MESSAGES.DATE_INVALIDE;
  } else if (valeur < DATE_MIN || valeur > dateMax) {
    erreurs.QUAND = remplacerVariables_(CONFIG.MESSAGES.DATE_HORS_PLAGE,
      { min: isoVersAffichage_(DATE_MIN), max: isoVersAffichage_(dateMax) });
  }
}

/**
 * Contrôle le montant saisi, dont le signe donne le type de l'opération :
 * positif (ou sans signe) = recette, négatif = dépense.
 * Le montant est arrondi au nombre de décimales autorisé et doit rester ≠ 0.
 * @param {SaisieOperation} saisie Saisie brute.
 * @param {Object<string, string>} erreurs Erreurs complétées.
 * @param {Object} operation Opération complétée.
 */
function validerMontant_(saisie, erreurs, operation) {
  if (texte_(saisie.COMBIEN) === '') {
    erreurs.COMBIEN = CONFIG.MESSAGES.CHAMP_OBLIGATOIRE;
    return;
  }
  const montant = parserMontant_(saisie.COMBIEN);
  const centimes = montant ? versCentimes_(montant.valeur) : 0;
  if (centimes <= 0) {
    erreurs.COMBIEN = remplacerVariables_(CONFIG.MESSAGES.MONTANT_INVALIDE,
      { decimales: CONFIG.SAISIE.DECIMALES_MONTANT });
    return;
  }
  operation.COMBIEN = versEuros_(centimes * montant.signe); // Arrondi sur la valeur absolue, puis signe
}

/* -----------------------------------------------------------------------------
 *  Utils.gs — Outils communs
 *
 *  Rôle : conversions (centimes/euros, dates), traitement des chaînes,
 *         construction des réponses { ok, ... } et des erreurs métier.
 *         Décrit aussi les structures de données échangées (@typedef).
 *  Fonctions principales : versCentimes_, versEuros_, parserMontant_,
 *         parserDateIso_, formaterDate_, remplacerVariables_, reponseOk_,
 *         reponseErreur_, erreurMetier_, erreurValidation_.
 *  Dépendances : CONFIG (Code.gs) uniquement.
 * -------------------------------------------------------------------------- */

/* === Structures de données ============================================== */

/**
 * Réponse de toute fonction api*.
 * @typedef {Object} ReponseApi
 * @property {boolean} ok Vrai si le traitement a réussi.
 * @property {*} [data] Données renvoyées en cas de succès.
 * @property {string} [message] Message d'erreur lisible.
 * @property {Object<string, string>} [erreurs] Erreurs par champ (clé de CONFIG.COLONNES).
 * @property {boolean} [accesRefuse] Vrai si l'utilisateur n'est pas (ou plus) autorisé.
 */

/**
 * Personne autorisée, déclarée dans CONFIG.UTILISATEURS.
 * @typedef {Object} Utilisateur
 * @property {string} email Adresse en minuscules.
 * @property {string} nom Nom affiché.
 * @property {string} role CONFIG.ROLES.LECTEUR ou CONFIG.ROLES.TRESORIER.
 */

/**
 * Opération lue dans la feuille, prête pour les calculs.
 * @typedef {Object} Operation
 * @property {number} ligne Numéro de ligne dans le Sheet.
 * @property {string} compte
 * @property {string} dateIso Date au format AAAA-MM-JJ ('' si absente ou invalide).
 * @property {string} qui
 * @property {string} quoi
 * @property {string} moyen
 * @property {number} centimes Montant en centimes entiers (positif = recette).
 * @property {string} exercice
 * @property {boolean} estRapproche
 * @property {string} categorie '' si non renseignée.
 * @property {string} commentaire
 */

/**
 * Opération envoyée au navigateur (détail des non rapprochées).
 * @typedef {Object} OperationAffichee
 * @property {number} ligne
 * @property {string} date Date au format d'affichage.
 * @property {string} qui
 * @property {string} quoi
 * @property {string} moyen
 * @property {number} montant Montant en euros.
 * @property {string} commentaire
 */

/**
 * Saisie du formulaire d'ajout, telle qu'envoyée par le navigateur.
 * @typedef {Object} SaisieOperation
 * @property {string} COMPTE
 * @property {string} QUAND Date AAAA-MM-JJ.
 * @property {string} QUI
 * @property {string} QUOI
 * @property {string} MOYEN
 * @property {string} COMBIEN Montant saisi (virgule ou point) : positif = recette, négatif = dépense.
 * @property {string} EXERCICE
 * @property {string} CATEGORIE
 * @property {string} COMMENTAIRE
 */

/**
 * Opération validée, prête à être écrite (clés de CONFIG.COLONNES).
 * @typedef {Object} OperationValidee
 * @property {string} COMPTE
 * @property {string} QUAND Date AAAA-MM-JJ.
 * @property {string} QUI Texte neutralisé (pas de formule).
 * @property {string} QUOI
 * @property {string} MOYEN
 * @property {number} COMBIEN Montant signé en euros.
 * @property {string} EXERCICE
 * @property {boolean} RAPPROCHE Toujours faux à la création.
 * @property {string} CATEGORIE
 * @property {string} COMMENTAIRE
 */

/**
 * Ligne du bilan par compte (montants en euros).
 * @typedef {Object} LigneBilan
 * @property {string} compte
 * @property {number} rapproche
 * @property {number} nonRapproche
 * @property {number} total
 * @property {number} nbNonRapprochees
 */

/**
 * Bilan par compte.
 * @typedef {Object} BilanParCompte
 * @property {LigneBilan[]} lignes Une ligne par compte.
 * @property {LigneBilan} total Ligne de total (compte = '').
 * @property {string} [miseAJour] Horodatage du calcul.
 * @property {string} [avertissement] Lignes ignorées, le cas échéant.
 */

/**
 * Ligne de la synthèse par catégorie (montants en euros).
 * @typedef {Object} LigneSynthese
 * @property {string} categorie
 * @property {number} recettes Somme des montants positifs.
 * @property {number} depenses Somme des montants négatifs, en valeur absolue.
 * @property {number} solde Recettes − dépenses.
 * @property {number} nbOperations
 * @property {string} nature 'RECETTE' si solde ≥ 0, sinon 'DEPENSE'.
 * @property {number} pourcentage Part dans le total des recettes ou des dépenses (0–100).
 * @property {?number} soldePrecedent Solde N-1 (si comparaison demandée).
 * @property {?number} ecart Solde − solde N-1 (si comparaison demandée).
 */

/**
 * Synthèse d'une période (exercice ou année civile).
 * @typedef {Object} SyntheseParCategorie
 * @property {string} regroupement 'EXERCICE' ou 'ANNEE'.
 * @property {string} periode Exercice ou année (AAAA) synthétisé.
 * @property {?string} periodePrecedente null si pas de comparaison possible.
 * @property {LigneSynthese[]} lignes Triées par solde décroissant.
 * @property {{recettes: number, depenses: number, resultat: number, nbOperations: number}} totaux
 * @property {{nombre: number, montant: number}} nonRapprochees
 */

/**
 * Vue croisée catégories × périodes (exercices ou années civiles).
 * @typedef {Object} VueCroisee
 * @property {string} regroupement 'EXERCICE' ou 'ANNEE'.
 * @property {string[]} periodes Colonnes ('' = sans exercice ou sans date).
 * @property {{categorie: string, soldes: number[]}[]} lignes
 * @property {number[]} totaux Total par période.
 */

/**
 * Ligne du suivi budgétaire (montants en euros).
 * @typedef {Object} LigneBudget
 * @property {string} categorie Catégorie de l'enveloppe ('' pour le total).
 * @property {number} budget Montant prévu.
 * @property {number} consomme Dépenses − recettes de la catégorie sur l'exercice.
 * @property {number} reste Budget − consommé (négatif en cas de dépassement).
 * @property {number} pourcentage Part consommée (peut dépasser 100).
 * @property {number} nbOperations
 * @property {string} statut 'OK', 'ALERTE' (seuil atteint) ou 'DEPASSE'.
 * @property {VentilationBudget} [ventilation] Absente sur la ligne de total.
 */

/**
 * Ligne du suivi budgétaire après report des dépassements sur les autres
 * enveloppes, au prorata de leur budget (montants en euros).
 * @typedef {Object} VentilationBudget
 * @property {number} recu Part des dépassements d'autres enveloppes absorbée.
 * @property {number} cede Part du dépassement de l'enveloppe reportée sur les autres.
 * @property {number} consomme Consommé + reçu − cédé.
 * @property {number} reste
 * @property {number} pourcentage
 * @property {string} statut
 */

/**
 * Suivi du budget prévisionnel d'un exercice.
 * @typedef {Object} SuiviBudgets
 * @property {string} exercice Exercice suivi.
 * @property {LigneBudget[]} lignes Une ligne par enveloppe, dans l'ordre de CONFIG.
 * @property {LigneBudget} totaux Ligne de total (categorie = ''), identique avec ou sans ventilation.
 * @property {number} depassementNonCouvert Dépassements que les autres enveloppes ne peuvent absorber.
 * @property {string[]} categoriesHorsListe Catégories du budget absentes de la liste de choix.
 * @property {string} [miseAJour] Horodatage du calcul.
 * @property {string} [avertissement] Lignes ignorées ou catégories inconnues, le cas échéant.
 */

/**
 * Contexte transmis au navigateur au démarrage.
 * @typedef {Object} ContexteClient
 * @property {Utilisateur} utilisateur
 * @property {boolean} estTresorier
 * @property {boolean} ajoutPossible Faux si la configuration est incomplète.
 * @property {string[]} problemes Problèmes de configuration détectés.
 * @property {string} urlClasseur URL du Sheet (trésorier uniquement).
 * @property {Object} reglages Libellés, formats et valeurs par défaut issus de CONFIG.
 * @property {?Object} listes Listes de choix, ou null si illisibles.
 */

/* === Montants ============================================================ */

/**
 * Convertit des euros en centimes entiers (évite les erreurs d'arrondi des flottants).
 * @param {number} euros Montant en euros.
 * @return {number} Montant en centimes entiers.
 */
function versCentimes_(euros) {
  const facteur = Math.pow(10, CONFIG.SAISIE.DECIMALES_MONTANT);
  // toFixed corrige les représentations du type 1.005 * 100 = 100.4999…
  return Math.round(Number((euros * facteur).toFixed(6)));
}

/**
 * Convertit des centimes entiers en euros.
 * @param {number} centimes Montant en centimes.
 * @return {number} Montant en euros.
 */
function versEuros_(centimes) {
  return centimes / Math.pow(10, CONFIG.SAISIE.DECIMALES_MONTANT);
}

/**
 * Lit un montant saisi (« 1 234,56 », « -12.5 », « +8 »). Le signe éventuel
 * donne le type : positif (ou sans signe) = recette, négatif = dépense.
 * @param {*} saisie Texte ou nombre saisi.
 * @return {?{valeur: number, signe: number, decimales: number}} valeur absolue,
 *     signe 1 ou -1 ; null si illisible.
 */
function parserMontant_(saisie) {
  const texte = String(saisie === null || saisie === undefined ? '' : saisie)
    .replace(/[\s  ]/g, '');
  const correspondance = /^([+-]?)(\d+(?:[.,](\d+))?)$/.exec(texte);
  if (!correspondance) return null;
  const decimales = correspondance[3] ? correspondance[3].length : 0;
  return {
    valeur: Number(correspondance[2].replace(',', '.')),
    signe: correspondance[1] === '-' ? -1 : 1,
    decimales
  };
}

/* === Dates =============================================================== */

/**
 * Vérifie et décompose une date AAAA-MM-JJ (date calendaire réelle).
 * @param {string} texte Date au format ISO court.
 * @return {?{annee: number, mois: number, jour: number}} null si invalide.
 */
function parserDateIso_(texte) {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texte || ''));
  if (!correspondance) return null;
  const [annee, mois, jour] = correspondance.slice(1).map(Number);
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  const estReelle = date.getUTCFullYear() === annee && date.getUTCMonth() === mois - 1
    && date.getUTCDate() === jour;
  return estReelle ? { annee, mois, jour } : null;
}

/**
 * Ajoute un nombre de jours à une date AAAA-MM-JJ (calcul indépendant du fuseau).
 * @param {string} dateIso Date de départ.
 * @param {number} jours Nombre de jours (peut être négatif).
 * @return {string} Nouvelle date AAAA-MM-JJ.
 */
function ajouterJoursIso_(dateIso, jours) {
  const { annee, mois, jour } = parserDateIso_(dateIso);
  return new Date(Date.UTC(annee, mois - 1, jour + jours)).toISOString().slice(0, 10);
}

/**
 * Convertit une date AAAA-MM-JJ en objet Date (à midi, pour qu'un écart de
 * fuseau ne fasse jamais changer de jour).
 * @param {string} dateIso Date ISO courte valide.
 * @return {Date} Date correspondante.
 */
function isoVersDate_(dateIso) {
  const { annee, mois, jour } = parserDateIso_(dateIso);
  return new Date(annee, mois - 1, jour, 12);
}

/**
 * Convertit une date AAAA-MM-JJ au format d'affichage (CONFIG.AFFICHAGE.FORMAT_DATE).
 * @param {string} dateIso Date ISO courte valide.
 * @return {string} Date affichable.
 */
function isoVersAffichage_(dateIso) {
  return formaterDate_(isoVersDate_(dateIso));
}

/**
 * Date du jour au format AAAA-MM-JJ, dans le fuseau de l'application.
 * @return {string} Date du jour.
 */
function aujourdhuiIso_() {
  return Utilities.formatDate(new Date(), CONFIG.APP.FUSEAU_HORAIRE, 'yyyy-MM-dd');
}

/** Vrai si le fuseau du projet est celui de CONFIG, mémorisé le temps d'une exécution. */
let estFuseauDuProjet_ = null;

/**
 * Convertit une valeur de cellule en date AAAA-MM-JJ.
 * Appelée pour chaque ligne : si le fuseau du projet est celui de CONFIG,
 * les méthodes natives de Date évitent un appel à Utilities par ligne.
 * @param {*} valeur Valeur lue dans le Sheet.
 * @return {string} Date ISO, ou '' si la valeur n'est pas une date valide.
 */
function celluleVersDateIso_(valeur) {
  if (!(valeur instanceof Date) || isNaN(valeur.getTime())) return '';
  if (estFuseauDuProjet_ === null) estFuseauDuProjet_ = Session.getScriptTimeZone() === CONFIG.APP.FUSEAU_HORAIRE;
  if (!estFuseauDuProjet_) return Utilities.formatDate(valeur, CONFIG.APP.FUSEAU_HORAIRE, 'yyyy-MM-dd');
  const deuxChiffres = (nombre) => String(nombre).padStart(2, '0');
  return `${valeur.getFullYear()}-${deuxChiffres(valeur.getMonth() + 1)}-${deuxChiffres(valeur.getDate())}`;
}

/**
 * Formate une date à afficher (format de CONFIG.AFFICHAGE.FORMAT_DATE).
 * @param {Date} date Date à formater.
 * @return {string} Date formatée.
 */
function formaterDate_(date) {
  return Utilities.formatDate(date, CONFIG.APP.FUSEAU_HORAIRE, CONFIG.AFFICHAGE.FORMAT_DATE);
}

/**
 * Formate une date et une heure (dernière mise à jour).
 * @param {Date} date Date à formater.
 * @return {string} Date et heure formatées.
 */
function formaterDateHeure_(date) {
  return Utilities.formatDate(date, CONFIG.APP.FUSEAU_HORAIRE, CONFIG.AFFICHAGE.FORMAT_DATE_HEURE);
}

/* === Chaînes ============================================================= */

/**
 * Normalise un en-tête ou un libellé pour comparaison : casse et espaces
 * superflus ignorés.
 * @param {*} valeur Valeur à normaliser.
 * @return {string} Valeur normalisée.
 */
function normaliserLibelle_(valeur) {
  return String(valeur === null || valeur === undefined ? '' : valeur)
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Convertit une valeur quelconque en texte sans espaces de début/fin.
 * @param {*} valeur Valeur à convertir.
 * @return {string} Texte.
 */
function texte_(valeur) {
  return String(valeur === null || valeur === undefined ? '' : valeur).trim();
}

/**
 * Empêche qu'un texte soit interprété comme une formule par Google Sheets :
 * un texte commençant par =, +, - ou @ est préfixé d'une apostrophe.
 * @param {string} texte Texte saisi.
 * @return {string} Texte sûr.
 */
function neutraliserFormule_(texte) {
  return /^[=+\-@]/.test(texte) ? `'${texte}` : texte;
}

/**
 * Remplace les variables {nom} d'un message.
 * @param {string} message Message avec variables.
 * @param {Object<string, *>} variables Valeurs à insérer.
 * @return {string} Message complété.
 */
function remplacerVariables_(message, variables) {
  return message.replace(/\{(\w+)\}/g, (tout, nom) =>
    (Object.prototype.hasOwnProperty.call(variables, nom) ? String(variables[nom]) : tout));
}

/**
 * Indique si une ligne du Sheet est vide (cellules vides ou cases décochées,
 * fréquentes sous la dernière opération).
 * @param {Array<*>} valeurs Valeurs de la ligne.
 * @return {boolean} Vrai si la ligne ne contient aucune donnée.
 */
function estLigneVide_(valeurs) {
  return valeurs.every((valeur) => valeur === '' || valeur === false || valeur === null);
}

/* === Réponses et erreurs ================================================= */

/**
 * Construit une réponse de succès.
 * @param {*} data Données renvoyées.
 * @return {ReponseApi} Réponse.
 */
function reponseOk_(data) {
  return { ok: true, data };
}

/**
 * Construit une réponse d'échec.
 * @param {string} message Message lisible.
 * @param {Object} [complements] Propriétés supplémentaires (erreurs, accesRefuse).
 * @return {ReponseApi} Réponse.
 */
function reponseErreur_(message, complements) {
  return Object.assign({ ok: false, message }, complements || {});
}

/**
 * Crée une erreur prévue dont le message peut être montré à l'utilisateur.
 * @param {string} message Message lisible.
 * @return {Error} Erreur marquée « métier ».
 */
function erreurMetier_(message) {
  const erreur = new Error(message);
  erreur.estMetier = true;
  return erreur;
}

/**
 * Crée une erreur de validation portant les erreurs par champ.
 * @param {Object<string, string>} erreurs Message par clé de champ.
 * @return {Error} Erreur de validation.
 */
function erreurValidation_(erreurs) {
  const erreur = erreurMetier_(CONFIG.MESSAGES.CORRIGER_ERREURS);
  erreur.erreursChamps = erreurs;
  return erreur;
}

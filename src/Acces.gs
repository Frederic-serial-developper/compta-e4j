/* -----------------------------------------------------------------------------
 *  Acces.gs — Contrôle d'accès
 *
 *  Rôle : identifier la personne connectée, vérifier sa présence (active)
 *         dans CONFIG.UTILISATEURS et son accès au Sheet, et contrôler son rôle. Appelé à chaque affichage
 *         de la page et à chaque appel d'une fonction api*.
 *  Fonctions principales : identifierUtilisateur_, exigerRole_.
 *  Dépendances : CONFIG (Code.gs), Donnees.gs (ouvrirClasseur_, ecrireJournal_), Utils.gs.
 * -------------------------------------------------------------------------- */

/**
 * Identifie la personne connectée et vérifie qu'elle est autorisée : présente
 * et active dans CONFIG.UTILISATEURS, et ayant accès au Sheet (double barrière).
 * @return {{estAutorise: boolean, email: string, message: string, utilisateur: ?Utilisateur}}
 */
function identifierUtilisateur_() {
  const email = texte_(Session.getActiveUser().getEmail()).toLowerCase();
  if (!email) return refuserAcces_('', CONFIG.MESSAGES.NON_IDENTIFIE);
  const refusNonAutorise = refuserAcces_(email, remplacerVariables_(CONFIG.MESSAGES.NON_AUTORISE, { email }));
  const personne = CONFIG.UTILISATEURS.find((ligne) =>
    texte_(ligne.email).toLowerCase() === email && ligne.actif === true);
  const role = personne ? normaliserRole_(personne.role) : null;
  if (!role) return refusNonAutorise;
  try {
    ouvrirClasseur_();
  } catch (erreur) {
    console.warn(`Ouverture du classeur impossible pour ${email} : ${erreur.message}`);
    return refusNonAutorise;
  }
  return {
    estAutorise: true,
    email,
    message: '',
    utilisateur: { email, nom: texte_(personne.nom) || email, role }
  };
}

/**
 * Vérifie que l'utilisateur possède le rôle exigé ; journalise sinon.
 * Le rôle Trésorier inclut les droits du rôle Lecteur.
 * @param {Utilisateur} utilisateur Utilisateur identifié.
 * @param {?string} roleRequis Rôle exigé, ou null si aucun rôle particulier.
 * @throws {Error} Erreur métier « droits insuffisants ».
 */
function exigerRole_(utilisateur, roleRequis) {
  if (!roleRequis || utilisateur.role === roleRequis) return;
  if (roleRequis === CONFIG.ROLES.LECTEUR && utilisateur.role === CONFIG.ROLES.TRESORIER) return;
  ecrireJournal_(CONFIG.TECHNIQUE.ACTIONS_JOURNAL.REFUS, utilisateur.email,
    `${CONFIG.MESSAGES.DROITS_INSUFFISANTS} (rôle ${utilisateur.role}, requis ${roleRequis})`);
  throw erreurMetier_(CONFIG.MESSAGES.DROITS_INSUFFISANTS);
}

/* === Fonctions internes ================================================== */

/**
 * Retrouve le rôle officiel (CONFIG.ROLES) correspondant au rôle déclaré dans
 * CONFIG.UTILISATEURS, sans tenir compte de la casse ni des espaces.
 * @param {string} saisie Rôle déclaré.
 * @return {?string} Rôle officiel, ou null si inconnu.
 */
function normaliserRole_(saisie) {
  const cherche = normaliserLibelle_(saisie);
  return Object.values(CONFIG.ROLES).find((role) => normaliserLibelle_(role) === cherche) || null;
}

/**
 * Construit un résultat d'identification négatif.
 * @param {string} email Adresse détectée.
 * @param {string} message Message à afficher.
 * @return {{estAutorise: boolean, email: string, message: string, utilisateur: null}}
 */
function refuserAcces_(email, message) {
  return { estAutorise: false, email, message, utilisateur: null };
}

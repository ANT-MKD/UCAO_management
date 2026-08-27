/** Pages placeholder (WIP) — une entrée = une route `/admin/wip/:pageId`. */

export interface AdminWipPage {
  title: string;
  section: string;
}

export const ADMIN_WIP_PAGES: Record<string, AdminWipPage> = {
  // Étudiants
  "etudiants-interdire": { title: "Interdire / Autoriser étudiants", section: "Étudiants" },

  // Professeurs
  "prof-statut-cours": { title: "Mise à jour statut cours", section: "Professeurs" },
  "prof-pointage-nouveau": { title: "Nouveau pointage", section: "Professeurs" },
  "prof-pointage-traitement": { title: "Traitement pointage", section: "Professeurs" },

  // Finances — Quittance
  "fin-quittance-masse": { title: "Émission en masse", section: "Finances · Quittance" },

  // Finances — Encaissement
  "fin-enc-pec": { title: "Nouvel encaissement de PEC", section: "Finances · Encaissement" },
  "fin-enc-pec-masse": { title: "Nouvel encaissement de PEC en masse", section: "Finances · Encaissement" },
  "fin-enc-pec-liste": { title: "Liste encaissement PEC", section: "Finances · Encaissement" },
  "fin-enc-pec-masse2": { title: "PEC en masse", section: "Finances · Encaissement" },
  "fin-enc-facture": { title: "Facture autres services", section: "Finances · Encaissement" },
  "fin-enc-candidature": { title: "Candidature", section: "Finances · Encaissement" },
  "fin-enc-autorisation": { title: "Autorisation paiement", section: "Finances · Encaissement" },
  "fin-enc-avoir": { title: "Avoir", section: "Finances · Encaissement" },

  // Finances — Avoir
  "fin-avoir-depot": { title: "Dépôt avoir", section: "Finances · Avoir" },
  "fin-avoir-remboursement": { title: "Remboursement avoir", section: "Finances · Avoir" },
  "fin-avoir-remboursements": { title: "Les remboursements", section: "Finances · Avoir" },
  "fin-avoir-consentement": { title: "Consentement avoir", section: "Finances · Avoir" },

  // Finances — Décompte
  "fin-decompte-terme": { title: "À terme", section: "Finances · Décompte" },

  // Finances — divers
  "fin-devis": { title: "Devis", section: "Finances" },
  "fin-reduction-autorisee": { title: "Réduction autorisée", section: "Finances · Réduction" },
  "fin-reduction-frais": { title: "Réduction frais", section: "Finances · Réduction" },
  "fin-maj-supprimer": { title: "Supprimer frais étudiant", section: "Finances · Mise à jour frais" },
  "fin-maj-ajouter-masse": { title: "Ajout frais en masse", section: "Finances · Mise à jour frais" },
  "fin-maj-suppression": { title: "Suppression frais", section: "Finances · Mise à jour frais" },
  "fin-reprise-nouvelle": { title: "Nouvelle reprise frais étudiant", section: "Finances · Reprise frais" },
  "fin-reprise-liste": { title: "Reprise frais étudiant", section: "Finances · Reprise frais" },
  "fin-rappel": { title: "Rappel des paiements", section: "Finances" },
  "fin-pec-organisme": { title: "Organisme de PEC", section: "Finances · Prise en charge" },
  "fin-pec-liste": { title: "Les prises en charge", section: "Finances · Prise en charge" },
  "fin-pec-regularisation": { title: "Régularisation prise en charge", section: "Finances · Prise en charge" },
  "fin-export": { title: "Export comptable", section: "Finances" },
  "fin-derogation": { title: "Dérogation des paiements", section: "Finances" },

  // Scolarité
  "scol-param": { title: "Paramétrage scolarité", section: "Scolarité" },
  "scol-insc-definitive": { title: "Inscription définitive", section: "Scolarité · Inscription" },
  "scol-eval-nouvelle": { title: "Nouvelle évaluation", section: "Scolarité · Évaluation" },
  "scol-eval-devoir": { title: "Devoir", section: "Scolarité · Évaluation" },
  "scol-eval-poids": { title: "Mise à jour poids évaluation", section: "Scolarité · Évaluation" },
  "scol-eval-poids-masse": { title: "Mise à jour poids évaluation en masse", section: "Scolarité · Évaluation" },
  "scol-notes-rattrapage": { title: "Rattrapage", section: "Scolarité · Notes" },
  "scol-maj-cours-force": { title: "Ajout cours forcé", section: "Scolarité · Mise à jour cours" },
  "scol-abandon": { title: "Abandon", section: "Scolarité" },
  "scol-absence": { title: "Absence", section: "Scolarité" },
  "scol-retard": { title: "Retard", section: "Scolarité" },
  "scol-ass-nouvelle": { title: "Nouvelle assiduité", section: "Scolarité · Assiduité" },
  "scol-ass-liste": { title: "Les assiduités", section: "Scolarité · Assiduité" },
  "scol-ass-periode": { title: "Absence par période", section: "Scolarité · Assiduité" },
  "scol-ass-periode-liste": { title: "Liste absence par période", section: "Scolarité · Assiduité" },

  // Communication
  "com-param": { title: "Paramétrage de la communication", section: "Communication" },
  "com-mails": { title: "Liste mails envoyés", section: "Communication" },
  "com-validation": { title: "Validation mails", section: "Communication" },
  "com-publicite": { title: "Publicité et actualité", section: "Communication" },

  // Bulletins
  "bul-param": { title: "Paramétrage bulletins", section: "Bulletins" },
  "bul-declassement": { title: "Déclassement élèves", section: "Bulletins" },

  // Sécurité
  "sec-user-add": { title: "Ajouter nouvel utilisateur", section: "Sécurité" },
  "sec-droits": { title: "Droit accès", section: "Sécurité" },
};

export function wipHref(pageId: string): string {
  return `/admin/wip/${pageId}`;
}

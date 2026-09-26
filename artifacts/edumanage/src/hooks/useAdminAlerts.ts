import { useStudentStore, useNotes, useStudentRequests, useCahiers } from "@/hooks/useStudentStore";
import { useMailsEnvoyes } from "@/hooks/useMailEnvoyeStore";
import { useDemandesReinitialisation } from "@/hooks/usePinActivationStore";
import { usePaiementsDeclares } from "@/hooks/usePaiementDeclareStore";
import { usePointages } from "@/hooks/usePointageStore";
import { useRallonges } from "@/hooks/useRallongeStore";
import { useRoles } from "@/hooks/useRoleStore";
import { useAuth } from "@/contexts/AuthContext";
import { resolveNavFromLocation } from "@/lib/adminNavConfig";
import { pourcentageStockage } from "@/lib/stockageLocal";

export interface AdminAlert {
  id: string;
  type: "danger" | "warning" | "info" | "success";
  message: string;
  temps: string;
  href: string;
  /** Nombre d'éléments en attente et domaine concerné — utilisés par le centre « À traiter ». */
  count: number;
  domaine: string;
  action: string;
}

/** « depuis 3 j » — ancienneté du plus vieil élément en attente (ce qui presse vraiment). */
function depuis(dates: string[]): string {
  const plusAncienne = dates.filter(Boolean).sort()[0];
  if (!plusAncienne) return "À traiter";
  const jours = Math.floor((Date.now() - new Date(plusAncienne).getTime()) / 86_400_000);
  if (jours <= 0) return "Depuis aujourd'hui";
  return jours === 1 ? "Depuis hier" : `Depuis ${jours} jours`;
}

/** Alertes admin réelles (centre « À traiter », dashboard, cloche du topbar) — jamais de contenu
 * statique : chaque entrée n'existe que si le signal qu'elle décrit est vraiment non nul, et
 * disparaît dès qu'il est résolu (la donnée sous-jacente fait foi). Seules les files que le rôle
 * du compte peut ouvrir sont listées. Ordonnées par gravité décroissante ; l'appelant tronque à sa
 * propre limite d'affichage. */
export function useAdminAlerts(): AdminAlert[] {
  const { currentUser } = useAuth();
  const roles = useRoles();
  const etudiants = useStudentStore();
  const notes = useNotes();
  const mailsEnvoyes = useMailsEnvoyes();
  const demandesReinit = useDemandesReinitialisation();
  const paiementsDeclares = usePaiementsDeclares();
  const demandes = useStudentRequests();
  const cahiers = useCahiers();
  const pointages = usePointages();
  const rallonges = useRallonges();

  const impayes = etudiants.filter((e) => e.soldeDu > 0).length;
  const notesEnAttente = notes.filter((n) => n.statut === "soumis_admin");
  const mailsEnAttente = mailsEnvoyes.filter((m) => m.statut === "en_attente_validation");
  const enAttenteInscription = etudiants.filter((e) => e.statut === "preinscrit" || e.statut === "en_attente").length;
  const reinitEnAttente = demandesReinit.filter((d) => !d.traiteeLe);
  const paiementsAVerifier = paiementsDeclares.filter((d) => d.statut === "a_verifier");
  const demandesNouvelles = demandes.filter((r) => r.status === "nouveau");
  const demandesEnCours = demandes.filter((r) => r.status === "en_cours");
  const cahiersAValider = cahiers.filter((c) => c.statut === "soumis");
  const pointagesAConfirmer = pointages.filter((p) => p.statut === "soumis");
  const rallongesAValider = rallonges.filter((r) => r.statut === "soumis");

  const alerts: AdminAlert[] = [];
  const push = (a: AdminAlert) => { if (a.count > 0) alerts.push(a); };

  const stockage = pourcentageStockage();
  if (stockage >= 80) {
    alerts.push({ id: "stockage", type: stockage >= 90 ? "danger" : "warning", count: stockage, domaine: "Sécurité", action: "Voir l'espace",
      message: `Stockage du navigateur utilisé à ${stockage} % — au-delà de 100 %, plus rien ne s'enregistre`, temps: "Maintenant", href: "/admin/security/reinitialisation-donnees" });
  }

  push({ id: "reinit-mdp", type: "danger", count: reinitEnAttente.length, domaine: "Sécurité", action: "Remettre un code",
    message: `${reinitEnAttente.length} demande(s) « mot de passe oublié » à traiter`, temps: depuis(reinitEnAttente.map((d) => d.createdAt)), href: "/admin/security/pin-activation" });
  push({ id: "paiements-declares", type: "warning", count: paiementsAVerifier.length, domaine: "Finances", action: "Vérifier",
    message: `${paiementsAVerifier.length} paiement(s) en ligne à vérifier`, temps: depuis(paiementsAVerifier.map((d) => d.declareLe)), href: "/admin/paiements-declares" });
  push({ id: "demandes-etudiants", type: "warning", count: demandesNouvelles.length, domaine: "Étudiants", action: "Répondre",
    message: `${demandesNouvelles.length} nouvelle(s) demande(s) étudiant(s) sans réponse`, temps: depuis(demandesNouvelles.map((r) => r.createdAt)), href: "/admin/requests" });
  push({ id: "cahiers-validation", type: "warning", count: cahiersAValider.length, domaine: "Pédagogie", action: "Valider",
    message: `${cahiersAValider.length} cahier(s) de séance à valider`, temps: depuis(cahiersAValider.map((c) => c.createdAt)), href: "/admin/cahiers" });
  push({ id: "notes-validation", type: "warning", count: notesEnAttente.length, domaine: "Pédagogie", action: "Valider",
    message: `${notesEnAttente.length} note(s) en attente de validation`, temps: depuis(notesEnAttente.map((n) => n.dateModification ?? n.dateCreation)), href: "/admin/notes" });
  push({ id: "pointages", type: "warning", count: pointagesAConfirmer.length, domaine: "Professeurs", action: "Confirmer",
    message: `${pointagesAConfirmer.length} pointage(s) d'heures à confirmer`, temps: depuis(pointagesAConfirmer.map((p) => p.createdAt)), href: "/admin/teachers/pointage" });
  push({ id: "rallonges", type: "warning", count: rallongesAValider.length, domaine: "Professeurs", action: "Examiner",
    message: `${rallongesAValider.length} demande(s) de rallonge horaire à examiner`, temps: depuis(rallongesAValider.map((r) => r.createdAt)), href: "/admin/teachers/rallonge" });
  push({ id: "com-validation", type: "warning", count: mailsEnAttente.length, domaine: "Communication", action: "Valider",
    message: `${mailsEnAttente.length} mail(s) en attente de validation (Communication)`, temps: depuis(mailsEnAttente.map((m) => m.date)), href: "/admin/communication/validation" });
  push({ id: "demandes-en-cours", type: "info", count: demandesEnCours.length, domaine: "Étudiants", action: "Terminer",
    message: `${demandesEnCours.length} demande(s) étudiant(s) prise(s) en charge, à clôturer`, temps: depuis(demandesEnCours.map((r) => r.updatedAt)), href: "/admin/requests" });
  push({ id: "preinscription", type: "info", count: enAttenteInscription, domaine: "Inscriptions", action: "Confirmer",
    message: `${enAttenteInscription} étudiant(s) préinscrit(s) ou en attente de confirmation d'inscription`, temps: "À traiter", href: "/admin/inscription/definitive" });
  push({ id: "impayes", type: "info", count: impayes, domaine: "Finances", action: "Relancer",
    message: `${impayes} étudiant(s) avec un solde impayé`, temps: "Suivi continu", href: "/admin/students" });

  // Un compte au rôle restreint ne voit que les files qu'il peut réellement ouvrir.
  const role = currentUser?.roleId ? roles.find((r) => r.id === currentUser.roleId) : undefined;
  if (!role) return alerts;
  return alerts.filter((a) => {
    const resolved = resolveNavFromLocation(a.href);
    if (!resolved.section) return true;
    const leafId = resolved.trail.length > 0 ? resolved.trail[resolved.trail.length - 1].id : resolved.section.id;
    return role.accessibleItemIds.includes(leafId);
  });
}

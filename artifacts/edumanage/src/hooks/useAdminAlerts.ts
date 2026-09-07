import { useStudentStore, useNotes } from "@/hooks/useStudentStore";
import { useMailsEnvoyes } from "@/hooks/useMailEnvoyeStore";

export interface AdminAlert {
  id: string;
  type: "danger" | "warning" | "info" | "success";
  message: string;
  temps: string;
  href: string;
}

/** Alertes admin réelles (dashboard + cloche du topbar) — jamais de contenu statique : chaque
 * entrée n'existe que si le signal qu'elle décrit est vraiment à zéro, et disparaît dès qu'il
 * est résolu (pas de flag "lue" à gérer, la donnée sous-jacente fait foi). Ordonnées par gravité
 * décroissante ; l'appelant tronque à sa propre limite d'affichage. */
export function useAdminAlerts(): AdminAlert[] {
  const etudiants = useStudentStore();
  const notes = useNotes();
  const mailsEnvoyes = useMailsEnvoyes();

  const impayes = etudiants.filter((e) => e.soldeDu > 0).length;
  const notesEnAttenteValidation = notes.filter((n) => n.statut === "soumis_admin").length;
  const mailsEnAttenteValidation = mailsEnvoyes.filter((m) => m.statut === "en_attente_validation").length;
  const enAttenteInscription = etudiants.filter((e) => e.statut === "preinscrit" || e.statut === "en_attente").length;

  const alerts: AdminAlert[] = [];
  if (impayes > 0) {
    alerts.push({ id: "impayes", type: "danger", message: `${impayes} étudiant(s) avec un solde impayé`, temps: "À l'instant", href: "/admin/students" });
  }
  if (notesEnAttenteValidation > 0) {
    alerts.push({ id: "notes-validation", type: "warning", message: `${notesEnAttenteValidation} note(s) en attente de validation`, temps: "À l'instant", href: "/admin/notes" });
  }
  if (mailsEnAttenteValidation > 0) {
    alerts.push({ id: "com-validation", type: "warning", message: `${mailsEnAttenteValidation} mail(s) en attente de validation (Communication)`, temps: "À l'instant", href: "/admin/communication/validation" });
  }
  if (enAttenteInscription > 0) {
    alerts.push({ id: "preinscription", type: "info", message: `${enAttenteInscription} étudiant(s) préinscrit(s) ou en attente de confirmation d'inscription`, temps: "À l'instant", href: "/admin/inscription/definitive" });
  }
  return alerts;
}

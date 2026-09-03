import { resetOperationalData } from "@/data/studentStore";

/** Clés localStorage explicitement conservées lors d'une réinitialisation : uniquement ce qui
 * est édité depuis l'une des 6 pages « Paramétrage X » (académique, finances, scolarité, emploi
 * du temps, communication, bulletins), les Rôles, les infos Établissement, et les réglages
 * d'accès (portails/fonctionnalités/signature/motifs de blocage). edumanage-app-store-v2 (compte
 * admin + étudiants/paiements/...) et edumanage-auth-session sont gérés séparément. */
const KEEP_KEYS = new Set([
  "edumanage-acad-cycle-v1",
  "edumanage-acad-entite-v1",
  "edumanage-acad-categorie-cours-v1",
  "edumanage-fin-type-frais-v1",
  "edumanage-fin-mode-paiement-v1",
  "edumanage-fin-type-facture-v1",
  "edumanage-fin-modele-frais-v1",
  "edumanage-fin-article-service-v1",
  "edumanage-fin-banque-v1",
  "edumanage-fin-activite-service-v1",
  "edumanage-fin-reduction-autorisee-v1",
  "edumanage-scolarite-config-v1",
  "edumanage-edt-type-seance-v1",
  "edumanage-edt-jour-ferie-v1",
  "edumanage-communication-groups-v1",
  "edumanage-communication-roles-v1",
  "edumanage-communication-api-config-v1",
  "edumanage-notification-evenementielle-v1",
  "edumanage-bulletin-methodes-store-v1",
  "edumanage-regles-validation-store-v1",
  "edumanage-mentions-store-v1",
  "edumanage-type-evaluation-store-v1",
  "edumanage-regroupement-devoir-store-v1",
  "edumanage-declassement-parametre-store-v1",
  "edumanage-roles-v1",
  "edumanage-etablissement-v1",
  "edumanage-portal-access-v1",
  "edumanage-portal-features-v1",
  "edumanage-signature-config-v1",
  "edumanage-motifs-blocage-v1",
]);

/** Vide toutes les données opérationnelles (étudiants, enseignants, filières, niveaux, semestres,
 * classes, salles, UE/EC, paiements/quittances, notes, délibérations, communications envoyées...)
 * en gardant le paramétrage (KEEP_KEYS ci-dessus), les rôles, l'établissement et uniquement le
 * compte admin qui déclenche l'action. Recharge la page pour que tous les stores — y compris ceux
 * qui mutent un tableau mockData.ts en place (filiereStore, teacherStore...) — se réinitialisent
 * proprement depuis un localStorage nettoyé. */
export function resetTestData(keepUserId: string) {
  resetOperationalData(keepUserId);

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (!key.startsWith("edumanage-")) continue;
    if (key === "edumanage-app-store-v2" || key === "edumanage-auth-session") continue;
    if (KEEP_KEYS.has(key)) continue;
    localStorage.removeItem(key);
  }

  window.location.reload();
}

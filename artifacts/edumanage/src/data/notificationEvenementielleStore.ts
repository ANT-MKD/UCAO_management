import { ecrireStockage } from "@/lib/stockageLocal";
const STORAGE_KEY = "edumanage-notification-evenementielle-v1";
const MIGRATION_KEY = "edumanage-notification-evenementielle-actives-par-defaut";

export interface NotificationEvenementielleRecord {
  id: string;
  code: string;
  description: string;
  actif: boolean;
  envoyerEtudiant: boolean;
  envoyerProfesseur: boolean;
  envoyerParent: boolean;
  envoyerTuteur: boolean;
  /** true pour les codes réellement branchés sur un événement de l'application — chaque appelant
   * (studentStore.ts, TeacherAbsencePage.tsx...) vérifie getNotificationEvenementielleParCode(code)
   * avant d'envoyer, au point d'appel réel plutôt que via un dispatcher central (studentStore.ts
   * ne peut pas dépendre d'un module qui l'importe lui-même). Les autres codes du catalogue restent
   * une configuration pure pour l'instant, sans événement réel derrière. */
  brancheReellement: boolean;
}

/** Toutes les notifications branchées sont actives d'origine : un établissement qui démarre doit
 * voir ses étudiants et professeurs prévenus sans devoir d'abord tout activer à la main. Chaque
 * notification reste désactivable dans Paramétrage communication. */
const SEED: Omit<NotificationEvenementielleRecord, "id">[] = [
  { code: "NOTIFICATION_ABSENCE", description: "Envoi notification après constat absence étudiant", actif: true, envoyerEtudiant: true, envoyerProfesseur: false, envoyerParent: false, envoyerTuteur: false, brancheReellement: true },
  { code: "NOTIFICATION_BLOCAGE_ETUDIANT", description: "Envoi notification après le blocage d'un étudiant", actif: true, envoyerEtudiant: true, envoyerProfesseur: false, envoyerParent: false, envoyerTuteur: false, brancheReellement: true },
  { code: "NOTIFICATION_DEBLOCAGE_ETUDIANT", description: "Envoi notification après le déblocage d'un étudiant", actif: true, envoyerEtudiant: true, envoyerProfesseur: false, envoyerParent: false, envoyerTuteur: false, brancheReellement: true },
  { code: "NOTIFICATION_ENCAISSEMENT", description: "Envoi notification après le règlement d'une facture", actif: true, envoyerEtudiant: true, envoyerProfesseur: false, envoyerParent: false, envoyerTuteur: false, brancheReellement: true },
  { code: "NOTIFICATION_INSCRIPTION", description: "Envoi notification après inscription étudiant dans une classe", actif: true, envoyerEtudiant: true, envoyerProfesseur: false, envoyerParent: false, envoyerTuteur: false, brancheReellement: true },
  { code: "NOTIFICATION_UPDATE_EDT", description: "Envoi notification après la mise à jour d'un emploi du temps", actif: true, envoyerEtudiant: true, envoyerProfesseur: true, envoyerParent: false, envoyerTuteur: false, brancheReellement: true },
  { code: "NOTIFICATION_UPDATE_NOTE", description: "Envoi notification après la mise à jour d'une note d'un étudiant", actif: true, envoyerEtudiant: true, envoyerProfesseur: false, envoyerParent: false, envoyerTuteur: false, brancheReellement: true },
  { code: "NOTIFICATION_VALIDATION_ABSENCE_PROF", description: "Envoi notification après la validation de l'absence d'un professeur", actif: true, envoyerEtudiant: false, envoyerProfesseur: true, envoyerParent: false, envoyerTuteur: false, brancheReellement: true },
];

function seed(): NotificationEvenementielleRecord[] {
  return SEED.map((s, i) => ({ id: `notif-evt-${i + 1}`, ...s }));
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function load(): NotificationEvenementielleRecord[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as NotificationEvenementielleRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seed();
    // Navigateurs enregistrés avec l'ancienne configuration d'origine (tout désactivé, jamais
    // touché) : on applique une seule fois les nouvelles valeurs d'origine. Si au moins une
    // notification a été activée, la configuration de l'établissement est respectée telle quelle.
    if (!localStorage.getItem(MIGRATION_KEY)) {
      ecrireStockage(MIGRATION_KEY, "1");
      if (parsed.every((n) => !n.actif)) {
        const actives = parsed.map((n) => (n.brancheReellement ? { ...n, actif: true } : n));
        ecrireStockage(STORAGE_KEY, JSON.stringify(actives));
        return actives;
      }
    }
    return parsed;
  } catch {
    return seed();
  }
}

let store: NotificationEvenementielleRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    ecrireStockage(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeNotificationsEvenementielles(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getNotificationsEvenementielles(): NotificationEvenementielleRecord[] {
  return store;
}

export function getNotificationEvenementielleParCode(code: string): NotificationEvenementielleRecord | undefined {
  return store.find((n) => n.code === code);
}

export interface NotificationEvenementiellePayload {
  code: string;
  description: string;
  actif: boolean;
  envoyerEtudiant: boolean;
  envoyerProfesseur: boolean;
  envoyerParent: boolean;
  envoyerTuteur: boolean;
}

export function upsertNotificationEvenementielle(payload: NotificationEvenementiellePayload, id?: string): NotificationEvenementielleRecord {
  const existing = id ? store.find((n) => n.id === id) : undefined;
  if (existing) {
    Object.assign(existing, payload);
    persist();
    return existing;
  }
  const record: NotificationEvenementielleRecord = { id: `notif-evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, brancheReellement: false, ...payload };
  store.unshift(record);
  persist();
  return record;
}

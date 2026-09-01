const STORAGE_KEY = "edumanage-notification-evenementielle-v1";

export interface NotificationEvenementielleRecord {
  id: string;
  code: string;
  description: string;
  actif: boolean;
  envoyerEtudiant: boolean;
  envoyerProfesseur: boolean;
  envoyerParent: boolean;
  envoyerTuteur: boolean;
  /** true pour les codes réellement branchés sur un événement de l'application (voir
   * notificationEngine.ts) — les autres restent un catalogue de configuration pure pour l'instant. */
  brancheReellement: boolean;
}

const SEED: Omit<NotificationEvenementielleRecord, "id">[] = [
  { code: "NOTIFICATION_ABSENCE", description: "Envoi notification après constat absence étudiant", actif: false, envoyerEtudiant: false, envoyerProfesseur: false, envoyerParent: false, envoyerTuteur: false, brancheReellement: false },
  { code: "NOTIFICATION_BLOCAGE_ETUDIANT", description: "Envoi notification après le blocage d'un étudiant", actif: false, envoyerEtudiant: false, envoyerProfesseur: false, envoyerParent: false, envoyerTuteur: false, brancheReellement: false },
  { code: "NOTIFICATION_DEBLOCAGE_ETUDIANT", description: "Envoi notification après le déblocage d'un étudiant", actif: false, envoyerEtudiant: false, envoyerProfesseur: false, envoyerParent: false, envoyerTuteur: false, brancheReellement: false },
  { code: "NOTIFICATION_ENCAISSEMENT", description: "Envoi notification après le règlement d'une facture", actif: false, envoyerEtudiant: true, envoyerProfesseur: false, envoyerParent: false, envoyerTuteur: false, brancheReellement: true },
  { code: "NOTIFICATION_INSCRIPTION", description: "Envoi notification après inscription étudiant dans une classe", actif: false, envoyerEtudiant: true, envoyerProfesseur: false, envoyerParent: false, envoyerTuteur: false, brancheReellement: true },
  { code: "NOTIFICATION_UPDATE_EDT", description: "Envoi notification après la mise à jour d'un emploi du temps", actif: false, envoyerEtudiant: true, envoyerProfesseur: true, envoyerParent: false, envoyerTuteur: false, brancheReellement: true },
  { code: "NOTIFICATION_UPDATE_NOTE", description: "Envoi notification après la mise à jour d'une note d'un étudiant", actif: false, envoyerEtudiant: false, envoyerProfesseur: false, envoyerParent: false, envoyerTuteur: false, brancheReellement: false },
  { code: "NOTIFICATION_VALIDATION_ABSENCE_PROF", description: "Envoi notification après la validation de l'absence d'un professeur", actif: false, envoyerEtudiant: false, envoyerProfesseur: true, envoyerParent: false, envoyerTuteur: false, brancheReellement: false },
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
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seed();
  } catch {
    return seed();
  }
}

let store: NotificationEvenementielleRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
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
  const record: NotificationEvenementielleRecord = { id: `notif-evt-${Date.now()}`, brancheReellement: false, ...payload };
  store.unshift(record);
  persist();
  return record;
}

import { relancerQuittances, reporterEcheanceQuittances } from "./studentStore";

const STORAGE_KEY = "edumanage-rappel-paiement-v1";

export interface RappelPaiementRecord {
  id: string;
  reference: string;
  date: string;
  filiereId: string;
  filiereLabel: string;
  niveau?: string;
  niveauLabel?: string;
  annee: string;
  fraisEchusAvant: string;
  nouvelleEcheance?: string;
  quittanceIds: string[];
  nbEtudiants: number;
  nbNotificationsEnvoyees: number;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: RappelPaiementRecord[];
  counter: number;
}

function load(): Persisted {
  if (typeof window === "undefined") return { records: [], counter: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [], counter: 0 };
    return JSON.parse(raw) as Persisted;
  } catch {
    return { records: [], counter: 0 };
  }
}

let store: Persisted = load();

function persist() {
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeRappelsPaiement(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRappelsPaiement(): RappelPaiementRecord[] {
  return store.records;
}

/** Cherche un rappel déjà envoyé pour exactement la même cohorte et le même seuil d'échéance — utilisé pour
 * avertir avant un doublon (même sélection relancée deux fois par erreur). */
export function trouverRappelIdentique(
  filiereId: string,
  niveau: string | undefined,
  annee: string,
  fraisEchusAvant: string,
): RappelPaiementRecord | undefined {
  return store.records.find(
    (r) => r.filiereId === filiereId && r.niveau === niveau && r.annee === annee && r.fraisEchusAvant === fraisEchusAvant,
  );
}

export interface EnvoyerRappelPayload {
  filiereId: string;
  filiereLabel: string;
  niveau?: string;
  niveauLabel?: string;
  annee: string;
  fraisEchusAvant: string;
  nouvelleEcheance?: string;
  quittanceIds: string[];
  nbEtudiants: number;
}

/** Envoie un rappel groupé : pousse une notification pour chaque quittance concernée (via relancerQuittances,
 * déjà existant), reporte l'échéance si demandé, et garde une trace persistée de cette campagne. */
export function envoyerRappelPaiement(payload: EnvoyerRappelPayload): RappelPaiementRecord {
  const date = new Date().toISOString().slice(0, 10);
  store.counter = (store.counter ?? 0) + 1;
  const reference = `RAP-${new Date(date).getFullYear()}-${String(store.counter).padStart(3, "0")}`;

  // On reporte l'échéance AVANT d'envoyer les notifications : relancerQuittances lit dateLimite au
  // moment de l'envoi pour composer son message, donc l'étudiant doit voir la date à jour, pas l'ancienne.
  if (payload.nouvelleEcheance) {
    reporterEcheanceQuittances(payload.quittanceIds, payload.nouvelleEcheance);
  }
  const nbNotificationsEnvoyees = relancerQuittances(payload.quittanceIds);

  const record: RappelPaiementRecord = {
    id: `rappel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    reference,
    date,
    filiereId: payload.filiereId,
    filiereLabel: payload.filiereLabel,
    niveau: payload.niveau,
    niveauLabel: payload.niveauLabel,
    annee: payload.annee,
    fraisEchusAvant: payload.fraisEchusAvant,
    nouvelleEcheance: payload.nouvelleEcheance,
    quittanceIds: payload.quittanceIds,
    nbEtudiants: payload.nbEtudiants,
    nbNotificationsEnvoyees,
  };

  store.records = [record, ...store.records];
  persist();
  return record;
}

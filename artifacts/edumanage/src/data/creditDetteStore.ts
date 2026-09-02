import { logAudit } from "./studentStore";

const STORAGE_KEY = "edumanage-credit-dette-store-v1";

/** Dette de crédit AJAC : une UE non validée qu'un étudiant "admis avec dette" doit repasser
 * alors qu'il a déjà été autorisé à monter au niveau supérieur (passage conditionnel). Créée à la
 * clôture d'une délibération annuelle, soldée manuellement par l'administration une fois la note
 * de reprise vérifiée (via l'ajout exceptionnel de l'étudiant au cours concerné, comme pour le
 * rattrapage). */
export interface CreditDetteRecord {
  id: string;
  etudiantId: string;
  etudiant: string;
  matricule: string;
  ueId: string;
  ueCode: string;
  ueLibelle: string;
  ueCredits: number;
  filiereId: string;
  filiere: string;
  niveauOrigine: string;
  niveauLabelOrigine: string;
  semestreOrigine: string;
  annee: string;
  statut: "en_cours" | "soldee";
  dateCreation: string;
  dateSoldee?: string;
  soldeePar?: string;
}

function load(): CreditDetteRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CreditDetteRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let store: CreditDetteRecord[] = load();

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeCreditDettes(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCreditDettes(): CreditDetteRecord[] {
  return store;
}

export function getDettesActivesPourEtudiant(etudiantId: string): CreditDetteRecord[] {
  return store.filter((d) => d.etudiantId === etudiantId && d.statut === "en_cours");
}

export function getCreditsDusPourEtudiant(etudiantId: string): number {
  return getDettesActivesPourEtudiant(etudiantId).reduce((s, d) => s + d.ueCredits, 0);
}

export interface CreditDettePayload {
  etudiantId: string;
  etudiant: string;
  matricule: string;
  ueId: string;
  ueCode: string;
  ueLibelle: string;
  ueCredits: number;
  filiereId: string;
  filiere: string;
  niveauOrigine: string;
  niveauLabelOrigine: string;
  semestreOrigine: string;
  annee: string;
}

/** Jamais de doublon pour la même UE d'origine encore active — idempotent si la délibération
 * annuelle qui l'a créée est rechargée. */
export function creerCreditDette(payload: CreditDettePayload): CreditDetteRecord {
  const existante = store.find(
    (d) => d.etudiantId === payload.etudiantId && d.ueId === payload.ueId && d.annee === payload.annee && d.statut === "en_cours",
  );
  if (existante) return existante;
  const record: CreditDetteRecord = {
    id: `dette-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    statut: "en_cours",
    dateCreation: new Date().toISOString(),
    ...payload,
  };
  store = [record, ...store];
  persist();
  return record;
}

/** Marquée soldée manuellement par l'administration une fois la reprise de l'UE vérifiée — jamais
 * automatique, car la note de reprise est saisie hors du cursus normal de l'étudiant (ajout
 * exceptionnel au cours de la classe d'origine). */
export function soldeCreditDette(id: string, actorId: string): void {
  const dette = store.find((d) => d.id === id);
  if (!dette || dette.statut === "soldee") return;
  dette.statut = "soldee";
  dette.dateSoldee = new Date().toISOString();
  dette.soldeePar = actorId;
  logAudit(actorId, "solder_dette_credit", "credit_dette", id, `${dette.etudiant} — ${dette.ueLibelle}`);
  persist();
}

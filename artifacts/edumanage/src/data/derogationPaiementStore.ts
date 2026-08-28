const STORAGE_KEY = "edumanage-derogation-paiement-v1";

export type PorteeDerogation = "reinscription" | "documents" | "global";

export const PORTEE_LABELS: Record<PorteeDerogation, string> = {
  reinscription: "Réinscription",
  documents: "Retrait de documents (bulletins, attestations)",
  global: "Global (tous les services)",
};

export interface DerogationPaiementRecord {
  id: string;
  reference: string;
  date: string;
  etudiantId: string;
  etudiantLabel: string;
  soldeDuConstate: number;
  portee: PorteeDerogation;
  motif: string;
  personnelId: string;
  personnelLabel: string;
  dateDebut: string;
  dateFin: string;
  revoquee: boolean;
  motifRevocation?: string;
  revoqueeLe?: string;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: DerogationPaiementRecord[];
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

export function subscribeDerogationsPaiement(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDerogationsPaiement(): DerogationPaiementRecord[] {
  return store.records;
}

export type StatutDerogation = "active" | "expiree" | "revoquee";

export function statutDerogation(d: DerogationPaiementRecord): StatutDerogation {
  if (d.revoquee) return "revoquee";
  const today = new Date().toISOString().slice(0, 10);
  if (today > d.dateFin) return "expiree";
  return "active";
}

export function derogationActivePour(
  records: DerogationPaiementRecord[],
  etudiantId: string,
  portee: PorteeDerogation,
): DerogationPaiementRecord | undefined {
  return records.find(
    (d) => d.etudiantId === etudiantId && (d.portee === portee || d.portee === "global") && statutDerogation(d) === "active",
  );
}

export function trouverDerogationIdentique(etudiantId: string, portee: PorteeDerogation): DerogationPaiementRecord | undefined {
  return derogationActivePour(store.records, etudiantId, portee);
}

export interface NouvelleDerogationPayload {
  etudiantId: string;
  etudiantLabel: string;
  soldeDuConstate: number;
  portee: PorteeDerogation;
  motif: string;
  personnelId: string;
  personnelLabel: string;
  dateDebut: string;
  dateFin: string;
}

export function genererDerogation(payload: NouvelleDerogationPayload): DerogationPaiementRecord {
  store.counter = (store.counter ?? 0) + 1;
  const year = new Date(payload.dateDebut).getFullYear() || new Date().getFullYear();
  const reference = `DER-${year}-${String(store.counter).padStart(3, "0")}`;
  const record: DerogationPaiementRecord = {
    id: `derog-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    date: new Date().toISOString().slice(0, 10),
    etudiantId: payload.etudiantId,
    etudiantLabel: payload.etudiantLabel,
    soldeDuConstate: payload.soldeDuConstate,
    portee: payload.portee,
    motif: payload.motif,
    personnelId: payload.personnelId,
    personnelLabel: payload.personnelLabel,
    dateDebut: payload.dateDebut,
    dateFin: payload.dateFin,
    revoquee: false,
  };
  store.records = [record, ...store.records];
  persist();
  return record;
}

export function revoquerDerogation(id: string, motif: string): DerogationPaiementRecord | undefined {
  const idx = store.records.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  const updated: DerogationPaiementRecord = {
    ...store.records[idx],
    revoquee: true,
    motifRevocation: motif,
    revoqueeLe: new Date().toISOString().slice(0, 10),
  };
  store.records = store.records.map((r, i) => (i === idx ? updated : r));
  persist();
  return updated;
}

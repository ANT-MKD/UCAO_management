import { ecrireStockage } from "@/lib/stockageLocal";
import { logAudit } from "./studentStore";

const STORAGE_KEY = "edumanage-repechage-ue-store-v1";

/** Repêchage d'une UE par le jury (règle UCAO) : une UE non acquise peut être déclarée acquise par
 * décision du jury, qui s'appuie notamment sur l'assiduité de l'étudiant. La vraie moyenne reste
 * imprimée sur le relevé, avec la mention « acquise par décision du jury » — on ne transforme
 * jamais une note. Chaque repêchage garde son motif, son auteur et sa date. */
export interface RepechageUeRecord {
  id: string;
  etudiantId: string;
  classeId: string;
  ueId: string;
  ueLibelle: string;
  semestreAlias: string;
  /** Moyenne de l'UE et absences non justifiées au moment de la décision (trace du dossier). */
  moyenne?: number;
  absences: number;
  motif: string;
  decidePar: string;
  decideLe: string;
}

function load(): RepechageUeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as RepechageUeRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let store: RepechageUeRecord[] = load();
const listeners = new Set<() => void>();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") ecrireStockage(STORAGE_KEY, JSON.stringify(store));
  listeners.forEach((fn) => fn());
}

export function subscribeRepechages(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRepechages(): RepechageUeRecord[] {
  return store;
}

export function getRepechageUe(etudiantId: string, classeId: string, ueId: string): RepechageUeRecord | undefined {
  return store.find((r) => r.etudiantId === etudiantId && r.classeId === classeId && r.ueId === ueId);
}

export function repecherUe(payload: Omit<RepechageUeRecord, "id" | "decideLe">): { ok: boolean; reason?: string; record?: RepechageUeRecord } {
  if (!payload.motif.trim()) return { ok: false, reason: "Indiquez le motif de la décision du jury." };
  if (getRepechageUe(payload.etudiantId, payload.classeId, payload.ueId)) return { ok: false, reason: "Cette UE est déjà repêchée." };
  const record: RepechageUeRecord = {
    ...payload,
    motif: payload.motif.trim(),
    id: `repechage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    decideLe: new Date().toISOString(),
  };
  store = [record, ...store];
  logAudit(payload.decidePar, "repechage_ue", "ue", payload.ueId, `${payload.ueLibelle} — ${record.motif}`);
  persist();
  return { ok: true, record };
}

export function annulerRepechage(id: string, actorId: string): void {
  const record = store.find((r) => r.id === id);
  if (!record) return;
  store = store.filter((r) => r.id !== id);
  logAudit(actorId, "annulation_repechage_ue", "ue", record.ueId, record.ueLibelle);
  persist();
}

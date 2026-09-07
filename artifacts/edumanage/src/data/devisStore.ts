import type { ModaliteFrais } from "./grilleFraisStore";

const STORAGE_KEY = "edumanage-devis-v1";

export interface DevisLigne {
  intitule: string;
  montantHT: number;
  modalite: ModaliteFrais;
  nbEcheances?: number;
  dateLimite?: string;
  montantTTC: number;
}

export interface DevisRecord {
  id: string;
  reference: string;
  date: string;
  filiereId: string;
  filiereLabel: string;
  niveau: string;
  niveauLabel: string;
  annee: string;
  modeleFraisId: string;
  modeleFraisLabel: string;
  beneficiaire: string;
  telephone: string;
  email?: string;
  adresse?: string;
  tauxTaxe: number;
  lignes: DevisLigne[];
  totalHT: number;
  totalTaxe: number;
  totalTTC: number;
  ajouteePar: string;
  annule: boolean;
  convertiEtudiantId?: string;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: DevisRecord[];
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
  // Nouvelle référence de tableau : useSyncExternalStore compare par Object.is
  // et ne re-rend pas si getDevis() renvoie la même référence.
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeDevis(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDevis(): DevisRecord[] {
  return store.records;
}

export function getDevisById(id: string): DevisRecord | undefined {
  return store.records.find((r) => r.id === id);
}

export interface GenererDevisPayload {
  filiereId: string;
  filiereLabel: string;
  niveau: string;
  niveauLabel: string;
  annee: string;
  modeleFraisId: string;
  modeleFraisLabel: string;
  beneficiaire: string;
  telephone: string;
  email?: string;
  adresse?: string;
  tauxTaxe: number;
  lignes: DevisLigne[];
  date: string;
  ajouteePar: string;
}

/** Génère un devis — document purement informatif, ne crée aucune dette ni quittance. */
export function genererDevis(payload: GenererDevisPayload): DevisRecord {
  store.counter = (store.counter ?? 0) + 1;
  const year = new Date(payload.date).getFullYear() || new Date().getFullYear();
  const reference = `DEV-${year}-${String(store.counter).padStart(3, "0")}`;

  const totalHT = payload.lignes.reduce((s, l) => s + l.montantHT, 0);
  const totalTTC = payload.lignes.reduce((s, l) => s + l.montantTTC, 0);

  const record: DevisRecord = {
    id: `devis-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    date: payload.date,
    filiereId: payload.filiereId,
    filiereLabel: payload.filiereLabel,
    niveau: payload.niveau,
    niveauLabel: payload.niveauLabel,
    annee: payload.annee,
    modeleFraisId: payload.modeleFraisId,
    modeleFraisLabel: payload.modeleFraisLabel,
    beneficiaire: payload.beneficiaire,
    telephone: payload.telephone,
    email: payload.email,
    adresse: payload.adresse,
    tauxTaxe: payload.tauxTaxe,
    lignes: payload.lignes,
    totalHT,
    totalTaxe: totalTTC - totalHT,
    totalTTC,
    ajouteePar: payload.ajouteePar,
    annule: false,
    convertiEtudiantId: undefined,
  };

  store.records = [record, ...store.records];
  persist();
  return record;
}

export function annulerDevis(id: string): { ok: boolean; reason?: string } {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.annule) return { ok: false, reason: "Devis introuvable ou déjà annulé." };
  if (record.convertiEtudiantId) {
    return { ok: false, reason: "Ce devis a déjà été converti en inscription — impossible de l'annuler." };
  }
  store.records = store.records.map((r) => (r.id === id ? { ...r, annule: true } : r));
  persist();
  return { ok: true };
}

/** Marque un devis comme converti en inscription réelle, en le liant à l'étudiant créé. */
export function marquerDevisConverti(id: string, etudiantId: string): void {
  const record = store.records.find((r) => r.id === id);
  if (!record) return;
  store.records = store.records.map((r) => (r.id === id ? { ...r, convertiEtudiantId: etudiantId } : r));
  persist();
}

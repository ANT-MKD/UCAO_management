import { getUserAccounts, pushNotificationEtPersister } from "./studentStore";

const STORAGE_KEY = "edumanage-decomptes-v1";

export type TypeDecompte = "taux_horaire" | "forfait" | "a_terme";

export interface DecompteLigne {
  pointageId: string;
  ecId: string;
  classeId: string;
  coursLabel: string;
  duree: number;
  date: string;
  niveauLabel: string;
  classeLabel: string;
  anneeLabel: string;
  semestreLabel: string;
  montantBrut: number;
  abattementPct: number;
  abattementMontant: number;
  montantNet: number;
}

export interface DecompteRecord {
  id: string;
  reference: string;
  date: string;
  teacherId: string;
  professeur: string;
  type: TypeDecompte;
  annee: string;
  montantDecompte: number;
  netAPayer: number;
  montantPaye: number;
  statut: "emis" | "annule";
  ajouteePar: string;
  lignes: DecompteLigne[];
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: DecompteRecord[];
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
  // et ne re-rend pas si getDecomptes() renvoie la même référence.
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeDecomptes(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDecomptes(): DecompteRecord[] {
  return store.records;
}

export function getDecompteById(id: string): DecompteRecord | undefined {
  return store.records.find((r) => r.id === id);
}

/** Identifiants de pointage déjà inclus dans un décompte non annulé — à exclure des prochaines générations. */
export function getPointageIdsDejaDecomptes(): Set<string> {
  const ids = new Set<string>();
  for (const r of store.records) {
    if (r.statut === "annule") continue;
    for (const l of r.lignes) ids.add(l.pointageId);
  }
  return ids;
}

export interface GenererDecomptePayload {
  teacherId: string;
  professeur: string;
  type: TypeDecompte;
  annee: string;
  date: string;
  ajouteePar: string;
  lignes: DecompteLigne[];
}

/** Génère un décompte à partir de lignes déjà calculées (une ligne par pointage validé retenu). */
export function genererDecompte(payload: GenererDecomptePayload): DecompteRecord {
  store.counter = (store.counter ?? 0) + 1;
  const year = new Date(payload.date).getFullYear() || new Date().getFullYear();
  const reference = `DC-${year}-${String(store.counter).padStart(3, "0")}`;

  const montantDecompte = payload.lignes.reduce((s, l) => s + l.montantBrut, 0);
  const netAPayer = payload.lignes.reduce((s, l) => s + l.montantNet, 0);

  const record: DecompteRecord = {
    id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    date: payload.date,
    teacherId: payload.teacherId,
    professeur: payload.professeur,
    type: payload.type,
    annee: payload.annee,
    montantDecompte,
    netAPayer,
    montantPaye: 0,
    statut: "emis",
    ajouteePar: payload.ajouteePar,
    lignes: payload.lignes,
  };

  store.records = [record, ...store.records];
  persist();

  const compte = getUserAccounts().find((u) => u.role === "teacher" && u.linkedId === record.teacherId);
  if (compte) pushNotificationEtPersister(compte.id, `Nouveau décompte disponible : ${record.reference} (${record.netAPayer.toLocaleString("fr-FR")} FCFA net à payer)`);

  return record;
}

/** Annule un décompte émis (les pointages qu'il contenait redeviennent éligibles pour un futur décompte). Refuse si un paiement a déjà été enregistré dessus. */
export function annulerDecompte(id: string): { ok: boolean; reason?: string } {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.statut === "annule") return { ok: false, reason: "Décompte introuvable ou déjà annulé." };
  if (record.montantPaye > 0) {
    return { ok: false, reason: "Ce décompte a déjà un paiement enregistré — impossible de l'annuler." };
  }
  store.records = store.records.map((r) => (r.id === id ? { ...r, statut: "annule" as const } : r));
  persist();
  return { ok: true };
}

/** Applique un paiement (total ou partiel) sur un décompte émis. Plafonné au net à payer. */
export function payerDecompte(id: string, montant: number): DecompteRecord | undefined {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.statut === "annule") return undefined;
  const nouveauMontantPaye = Math.min(record.netAPayer, record.montantPaye + Math.max(0, montant));
  const updated: DecompteRecord = { ...record, montantPaye: nouveauMontantPaye };
  store.records = store.records.map((r) => (r.id === id ? updated : r));
  persist();
  return updated;
}

/** Retire un paiement appliqué sur un décompte (ex. annulation d'un paiement professeur) : opération symétrique de payerDecompte(). */
export function reverserPaiementDecompte(id: string, montant: number): void {
  const record = store.records.find((r) => r.id === id);
  if (!record) return;
  const nouveauMontantPaye = Math.max(0, record.montantPaye - Math.max(0, montant));
  store.records = store.records.map((r) => (r.id === id ? { ...r, montantPaye: nouveauMontantPaye } : r));
  persist();
}

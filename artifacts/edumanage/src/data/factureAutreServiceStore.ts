const STORAGE_KEY = "edumanage-factures-autres-services-v1";

export interface FactureAutreServiceLigne {
  articleId: string;
  article: string;
  prixUnitaire: number;
  quantite: number;
  montant: number;
}

export interface FactureAutreServiceRecord {
  id: string;
  reference: string;
  date: string;
  beneficiaire: string;
  telephone?: string;
  adresse?: string;
  referenceExterne?: string;
  remarque: string;
  lignes: FactureAutreServiceLigne[];
  /** Montant réellement versé jusqu'ici (peut être partiel) — même logique que PaiementRecord.montant. */
  montant: number;
  moyen?: string;
  referenceBancairePaiement?: string;
  datePaiement?: string;
  ajouteePar: string;
  statut: "actif" | "annule";
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: FactureAutreServiceRecord[];
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
  // et ne re-rend pas si getFacturesAutreService() renvoie la même référence.
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeFacturesAutreService(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getFacturesAutreService(): FactureAutreServiceRecord[] {
  return store.records;
}

export function getFactureAutreServiceById(id: string): FactureAutreServiceRecord | undefined {
  return store.records.find((r) => r.id === id);
}

export interface AddFactureAutreServicePayload {
  beneficiaire: string;
  telephone?: string;
  adresse?: string;
  referenceExterne?: string;
  remarque: string;
  lignes: FactureAutreServiceLigne[];
  montantVerse: number;
  moyen?: string;
  referenceBancairePaiement?: string;
  datePaiement?: string;
  date: string;
  ajouteePar: string;
}

/** Crée une facture "autre service" pour un bénéficiaire libre (pas forcément un étudiant), avec un versement initial éventuellement partiel. */
export function addFactureAutreService(payload: AddFactureAutreServicePayload): FactureAutreServiceRecord {
  store.counter = (store.counter ?? 0) + 1;
  const year = new Date(payload.date).getFullYear() || new Date().getFullYear();
  const reference = `FAS-${year}-${String(store.counter).padStart(3, "0")}`;

  const record: FactureAutreServiceRecord = {
    id: `fas-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    date: payload.date,
    beneficiaire: payload.beneficiaire,
    telephone: payload.telephone,
    adresse: payload.adresse,
    referenceExterne: payload.referenceExterne,
    remarque: payload.remarque,
    lignes: payload.lignes,
    montant: Math.max(0, payload.montantVerse),
    moyen: payload.moyen,
    referenceBancairePaiement: payload.referenceBancairePaiement,
    datePaiement: payload.datePaiement,
    ajouteePar: payload.ajouteePar,
    statut: "actif",
  };

  store.records = [record, ...store.records];
  persist();
  return record;
}

export interface PayerFactureAutreServicePayload {
  id: string;
  montant: number;
  moyen: string;
  reference?: string;
  date: string;
}

/** Encaisse un règlement (total ou partiel) sur une facture déjà émise. */
export function payerFactureAutreService(payload: PayerFactureAutreServicePayload): FactureAutreServiceRecord | undefined {
  const f = store.records.find((r) => r.id === payload.id);
  if (!f || f.statut === "annule") return undefined;

  const montantFacture = f.lignes.reduce((s, l) => s + l.montant, 0);
  const nouveauMontantPaye = Math.min(montantFacture, f.montant + Math.max(0, payload.montant));

  const updated: FactureAutreServiceRecord = {
    ...f,
    montant: nouveauMontantPaye,
    moyen: payload.moyen || f.moyen,
    referenceBancairePaiement: payload.reference || f.referenceBancairePaiement,
    datePaiement: payload.date || f.datePaiement,
  };
  store.records = store.records.map((r) => (r.id === payload.id ? updated : r));
  persist();
  return updated;
}

/** Annule la facture (irréversible, comme l'annulation d'une quittance). */
export function cancelFactureAutreService(id: string): void {
  store.records = store.records.map((r) => (r.id === id ? { ...r, statut: "annule" } : r));
  persist();
}

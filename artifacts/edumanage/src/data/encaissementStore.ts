const STORAGE_KEY = "edumanage-encaissements-v1";

export interface EncaissementLigneDetail {
  label: string;
  montantApplique: number;
  montantLigneTotal: number;
}

export interface EncaissementRecord {
  id: string;
  reference: string;
  date: string;
  quittanceId: string;
  quittanceReference: string;
  quittanceDateEmission: string;
  quittanceDateLimite?: string;
  montantQuittanceTotal: number;
  etudiantId: string;
  payeur: string;
  filiere: string;
  annee: string;
  montant: number;
  moyen: string;
  referenceBancaire?: string;
  encaissePar: string;
  annulee: boolean;
  lignes: EncaissementLigneDetail[];
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: EncaissementRecord[];
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
  // et ne re-rend pas si getEncaissements() renvoie la même référence.
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeEncaissements(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getEncaissements(): EncaissementRecord[] {
  return store.records;
}

export function getEncaissementById(id: string): EncaissementRecord | undefined {
  return store.records.find((r) => r.id === id);
}

/** Répartit un versement en FIFO sur les rubriques d'une quittance, en tenant compte de ce qui était déjà couvert. Ne renvoie que les rubriques réellement touchées par CE versement. */
function allouerSurLignes(
  quittanceLignes: { label: string; montant: number }[],
  dejaPayeAvant: number,
  montantVerse: number,
): EncaissementLigneDetail[] {
  let couvertAvant = Math.max(0, dejaPayeAvant);
  let restant = Math.max(0, montantVerse);
  const result: EncaissementLigneDetail[] = [];
  for (const ligne of quittanceLignes) {
    const skip = Math.min(couvertAvant, ligne.montant);
    couvertAvant -= skip;
    const disponibleSurLigne = ligne.montant - skip;
    const applique = Math.min(restant, disponibleSurLigne);
    restant -= applique;
    if (applique > 0) {
      result.push({ label: ligne.label, montantApplique: applique, montantLigneTotal: ligne.montant });
    }
  }
  return result;
}

export interface EnregistrerEncaissementPayload {
  quittanceId: string;
  quittanceReference: string;
  quittanceDateEmission: string;
  quittanceDateLimite?: string;
  montantQuittanceTotal: number;
  quittanceLignes: { label: string; montant: number }[];
  dejaPayeAvant: number;
  etudiantId: string;
  payeur: string;
  filiere: string;
  annee: string;
  montant: number;
  moyen: string;
  referenceBancaire?: string;
  date: string;
  encaissePar: string;
}

/** Enregistre un versement réellement encaissé (total ou partiel) sur une quittance — un événement distinct de la quittance elle-même, avec son propre reçu. */
export function enregistrerEncaissement(payload: EnregistrerEncaissementPayload): EncaissementRecord {
  store.counter = (store.counter ?? 0) + 1;
  const year = new Date(payload.date).getFullYear() || new Date().getFullYear();
  const reference = `OP-${year}-${String(store.counter).padStart(3, "0")}`;

  const record: EncaissementRecord = {
    id: `enc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    date: payload.date,
    quittanceId: payload.quittanceId,
    quittanceReference: payload.quittanceReference,
    quittanceDateEmission: payload.quittanceDateEmission,
    quittanceDateLimite: payload.quittanceDateLimite,
    montantQuittanceTotal: payload.montantQuittanceTotal,
    etudiantId: payload.etudiantId,
    payeur: payload.payeur,
    filiere: payload.filiere,
    annee: payload.annee,
    montant: payload.montant,
    moyen: payload.moyen,
    referenceBancaire: payload.referenceBancaire,
    encaissePar: payload.encaissePar,
    annulee: false,
    lignes: allouerSurLignes(payload.quittanceLignes, payload.dejaPayeAvant, payload.montant),
  };

  store.records = [record, ...store.records];
  persist();
  return record;
}

/** Annule cet encaissement précis (pas les autres versements de la même quittance) : le montant reversé est retiré par l'appelant via reverserReglementQuittance. */
export function annulerEncaissement(id: string): EncaissementRecord | undefined {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.annulee) return undefined;
  store.records = store.records.map((r) => (r.id === id ? { ...r, annulee: true } : r));
  persist();
  return record;
}

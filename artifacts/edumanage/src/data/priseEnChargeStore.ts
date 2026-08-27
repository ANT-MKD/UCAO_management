import { payerQuittance, reverserReglementQuittance } from "./studentStore";

const STORAGE_KEY = "edumanage-prises-en-charge-v1";

export type TypePEC = "montant" | "pourcentage";

export interface PriseEnChargeLigne {
  quittanceId: string;
  label: string;
  montantFrais: number;
  montantPEC: number;
}

export interface PriseEnChargeRecord {
  id: string;
  reference: string;
  /** Référence propre à l'organisme (son propre dossier), distincte de notre numéro interne. */
  referenceExterne?: string;
  type: TypePEC;
  dateSaisie: string;
  organismeId: string;
  organisme: string;
  etudiantId: string;
  etudiant: string;
  filiere: string;
  annee: string;
  debut: string;
  fin: string;
  dateLimite: string;
  montant?: number;
  pourcentage?: number;
  document?: string;
  /** Utilisateur (admin/comptabilité) ayant saisi la prise en charge. */
  ajouteePar: string;
  lignes: PriseEnChargeLigne[];
  annulee: boolean;
  /** Montant effectivement reçu de l'organisme (encaissement PEC) — distinct du montant engagé/appliqué aux quittances. */
  montantEncaisse: number;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: PriseEnChargeRecord[];
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
  // et ne re-rend pas si getPrisesEnCharge() renvoie la même référence.
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribePrisesEnCharge(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPrisesEnCharge(): PriseEnChargeRecord[] {
  return store.records;
}

export function getPriseEnChargeById(id: string): PriseEnChargeRecord | undefined {
  return store.records.find((r) => r.id === id);
}

export interface AddPriseEnChargePayload {
  type: TypePEC;
  dateSaisie: string;
  organismeId: string;
  organisme: string;
  etudiantId: string;
  etudiant: string;
  filiere: string;
  annee: string;
  debut: string;
  fin: string;
  dateLimite: string;
  montant?: number;
  pourcentage?: number;
  document?: string;
  referenceExterne?: string;
  ajouteePar: string;
  lignes: PriseEnChargeLigne[];
}

function makeReference(annee: string): string {
  store.counter = (store.counter ?? 0) + 1;
  return `PEC-${annee.slice(0, 4)}-${String(store.counter).padStart(3, "0")}`;
}

/** Enregistre une prise en charge : règle chaque quittance retenue (payerQuittance) avec l'organisme comme moyen de paiement. */
export function addPriseEnCharge(payload: AddPriseEnChargePayload): PriseEnChargeRecord {
  const reference = makeReference(payload.annee);

  const lignesAppliquees = payload.lignes.filter((l) => l.montantPEC > 0);
  lignesAppliquees.forEach((l) => {
    payerQuittance({ id: l.quittanceId, montant: l.montantPEC, moyen: "Prise en charge", reference, date: payload.dateSaisie });
  });

  const record: PriseEnChargeRecord = {
    id: `pec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    referenceExterne: payload.referenceExterne,
    type: payload.type,
    dateSaisie: payload.dateSaisie,
    organismeId: payload.organismeId,
    organisme: payload.organisme,
    etudiantId: payload.etudiantId,
    etudiant: payload.etudiant,
    filiere: payload.filiere,
    annee: payload.annee,
    debut: payload.debut,
    fin: payload.fin,
    dateLimite: payload.dateLimite,
    montant: payload.montant,
    pourcentage: payload.pourcentage,
    document: payload.document,
    ajouteePar: payload.ajouteePar,
    lignes: lignesAppliquees,
    annulee: false,
    montantEncaisse: 0,
  };

  store.records = [record, ...store.records];
  persist();
  return record;
}

/** Annule la prise en charge : retire le règlement appliqué sur chaque quittance couverte (le solde élève est restauré). */
export function cancelPriseEnCharge(id: string): void {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.annulee) return;
  record.lignes.forEach((l) => reverserReglementQuittance(l.quittanceId, l.montantPEC));
  store.records = store.records.map((r) => (r.id === id ? { ...r, annulee: true } : r));
  persist();
}

export interface ProlongerPriseEnChargePayload {
  nouvelleFin: string;
  nouvelleDateLimite: string;
  lignes: PriseEnChargeLigne[];
}

/** Régularisation : prolonge la période de la PEC et applique son montant/pourcentage aux frais nouvellement éligibles. */
export function prolongerPriseEnCharge(id: string, payload: ProlongerPriseEnChargePayload): PriseEnChargeRecord | undefined {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.annulee) return undefined;

  const lignesAppliquees = payload.lignes.filter((l) => l.montantPEC > 0);
  lignesAppliquees.forEach((l) => {
    payerQuittance({ id: l.quittanceId, montant: l.montantPEC, moyen: "Prise en charge", reference: record.reference, date: new Date().toISOString().slice(0, 10) });
  });

  const updated: PriseEnChargeRecord = {
    ...record,
    fin: payload.nouvelleFin,
    dateLimite: payload.nouvelleDateLimite,
    lignes: [...record.lignes, ...lignesAppliquees],
  };
  store.records = store.records.map((r) => (r.id === id ? updated : r));
  persist();
  return updated;
}

/** Retire une seule ligne déjà couverte par la PEC (ex. l'organisme conteste ce frais précis) : le reste de la PEC n'est pas touché. */
export function retirerLignePriseEnCharge(id: string, quittanceId: string): void {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.annulee) return;
  const ligne = record.lignes.find((l) => l.quittanceId === quittanceId);
  if (!ligne) return;
  reverserReglementQuittance(quittanceId, ligne.montantPEC);
  store.records = store.records.map((r) =>
    r.id === id ? { ...r, lignes: r.lignes.filter((l) => l.quittanceId !== quittanceId) } : r,
  );
  persist();
}

/** Enregistre qu'un montant a été effectivement reçu de l'organisme pour cette PEC (encaissement PEC). */
export function enregistrerEncaissementSurPEC(id: string, montant: number): void {
  const record = store.records.find((r) => r.id === id);
  if (!record) return;
  store.records = store.records.map((r) =>
    r.id === id ? { ...r, montantEncaisse: (r.montantEncaisse ?? 0) + Math.max(0, montant) } : r,
  );
  persist();
}

import { ecrireStockage } from "@/lib/stockageLocal";
import { getUserAccounts, pushNotificationEtPersister } from "./studentStore";
import { modeSupabase, supabase } from "@/lib/supabase";
const STORAGE_KEY = "edumanage-teacher-contracts-v1";

export interface ContractLigne {
  ecId: string;
  classeId: string;
  modePaiement: "taux_horaire" | "forfait";
  montant: number;
}

export interface AvenantRecord {
  numero: number;
  date: string;
  motif: string;
  dateFinAvant: string;
  dateFinApres: string;
  lignesAvant: ContractLigne[];
  lignesApres: ContractLigne[];
}

export interface TeacherContractRecord {
  id: string;
  teacherId: string;
  annee: string;
  dateDebut: string;
  dateFin: string;
  createdAt: string;
  lignes: ContractLigne[];
  avenants: AvenantRecord[];
  resilie: boolean;
  dateResiliation?: string;
  motifResiliation?: string;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): TeacherContractRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TeacherContractRecord[];
  } catch {
    return [];
  }
}

let store: TeacherContractRecord[] = load();

function persist() {
  // Nouvelle référence de tableau : useSyncExternalStore compare par
  // Object.is et ne re-rend pas si getTeacherContracts() renvoie la même référence.
  store = store.slice();
  if (typeof window !== "undefined") {
    ecrireStockage(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeTeacherContracts(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTeacherContracts(): TeacherContractRecord[] {
  return store;
}

/** Contrats de la base (avec Supabase) : tous pour l'administration, les siens pour un professeur. */
export function remplacerContratsEnseignants(records: TeacherContractRecord[]) {
  store = records;
  persist();
}

/** Numéro du prochain contrat : attribué par la base avec Supabase (jamais deux fois le même, même
 * depuis deux postes), sinon calculé sur ce poste. */
export async function reserverNumeroContrat(): Promise<string> {
  if (!modeSupabase || !supabase) return makeContractNumero();
  const { data, error } = await supabase.rpc("attribuer_numero_contrat");
  if (error || typeof data !== "string") throw new Error(error?.message || "Numéro de contrat indisponible : réessayez.");
  return data;
}

export function getTeacherContract(id: string): TeacherContractRecord | undefined {
  return store.find((c) => c.id === id);
}

export function makeContractNumero(): string {
  const seq = store.length + 1;
  return `CTR-${String(seq).padStart(4, "0")}`;
}

const dateFr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Prévient le professeur sur son portail (contrat, avenant, résiliation) ; avec Supabase, c'est la
 * base qui le prévient. */
function notifierProfesseur(teacherId: string, message: string) {
  if (modeSupabase) return;
  const compte = getUserAccounts().find((u) => u.role === "teacher" && u.linkedId === teacherId);
  if (compte) pushNotificationEtPersister(compte.id, message);
}

export function addTeacherContract(
  payload: Omit<TeacherContractRecord, "id" | "createdAt" | "avenants" | "resilie">,
  numero: string = makeContractNumero(),
): TeacherContractRecord {
  const record: TeacherContractRecord = {
    ...payload,
    id: numero,
    createdAt: new Date().toISOString(),
    avenants: [],
    resilie: false,
  };
  store.push(record);
  persist();
  notifierProfesseur(record.teacherId, `Nouveau contrat ${record.id} (${record.annee}) du ${dateFr(record.dateDebut)} au ${dateFr(record.dateFin)} — ${montantTotal(record).toLocaleString("fr-FR")} F CFA. Consultez « Mon contrat ».`);
  return record;
}

/** Applique un avenant : nouvelles lignes / nouvelle date de fin, avec journalisation avant/après. */
export function addAvenant(
  contractId: string,
  payload: { motif: string; dateFin: string; lignes: ContractLigne[] },
): TeacherContractRecord | undefined {
  const idx = store.findIndex((c) => c.id === contractId);
  if (idx < 0) return undefined;
  const contract = store[idx];

  const avenant: AvenantRecord = {
    numero: contract.avenants.length + 1,
    date: new Date().toISOString(),
    motif: payload.motif,
    dateFinAvant: contract.dateFin,
    dateFinApres: payload.dateFin,
    lignesAvant: contract.lignes,
    lignesApres: payload.lignes,
  };

  store[idx] = {
    ...contract,
    dateFin: payload.dateFin,
    lignes: payload.lignes,
    avenants: [...contract.avenants, avenant],
  };
  persist();
  notifierProfesseur(contract.teacherId, `Avenant n° ${avenant.numero} à votre contrat ${contract.id} : fin au ${dateFr(payload.dateFin)} — ${payload.motif}.`);
  return store[idx];
}

export function resilierContract(id: string, motif: string): TeacherContractRecord | undefined {
  const idx = store.findIndex((c) => c.id === id);
  if (idx < 0) return undefined;
  store[idx] = {
    ...store[idx],
    resilie: true,
    dateResiliation: new Date().toISOString().slice(0, 10),
    motifResiliation: motif,
  };
  persist();
  notifierProfesseur(store[idx].teacherId, `Votre contrat ${id} a été résilié${motif.trim() ? ` : ${motif.trim()}` : ""}.`);
  return store[idx];
}

export function montantTotal(contract: TeacherContractRecord): number {
  return contract.lignes.reduce((sum, l) => sum + l.montant, 0);
}

export function contractStatut(contract: TeacherContractRecord): "actif" | "expire" | "resilie" {
  if (contract.resilie) return "resilie";
  const today = new Date().toISOString().slice(0, 10);
  return contract.dateFin < today ? "expire" : "actif";
}

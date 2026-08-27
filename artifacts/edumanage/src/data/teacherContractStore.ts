const STORAGE_KEY = "edumanage-teacher-contracts-v1";

export interface ContractLigne {
  ecId: string;
  classeId: string;
  modePaiement: "taux_horaire" | "forfait";
  montant: number;
}

export interface TeacherContractRecord {
  id: string;
  teacherId: string;
  annee: string;
  dateDebut: string;
  dateFin: string;
  createdAt: string;
  lignes: ContractLigne[];
  nombreAvenants: number;
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
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

export function makeContractNumero(): string {
  const seq = store.length + 1;
  return `CTR-${String(seq).padStart(4, "0")}`;
}

export function addTeacherContract(
  payload: Omit<TeacherContractRecord, "id" | "createdAt" | "nombreAvenants">,
): TeacherContractRecord {
  const record: TeacherContractRecord = {
    ...payload,
    id: makeContractNumero(),
    createdAt: new Date().toISOString(),
    nombreAvenants: 0,
  };
  store.push(record);
  persist();
  return record;
}

export function montantTotal(contract: TeacherContractRecord): number {
  return contract.lignes.reduce((sum, l) => sum + l.montant, 0);
}

export function contractStatut(contract: TeacherContractRecord): "actif" | "expire" {
  const today = new Date().toISOString().slice(0, 10);
  return contract.dateFin < today ? "expire" : "actif";
}

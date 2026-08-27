const STORAGE_KEY = "edumanage-organismes-pec-v1";

export interface OrganismePECRecord {
  id: string;
  intitule: string;
  adresse: string;
  telephone?: string;
  email?: string;
  remarques?: string;
  contactNom: string;
  contactTelephone?: string;
  contactEmail?: string;
}

/** Seul APES/ISAET dispose de données complètes dans nos références actuelles — les autres organismes cités (3FPT, Office national des pupilles de la nation, Mairie Thiès Ville, Mairie Mont Rolland…) sont à ajouter via le formulaire avec leurs vraies coordonnées. */
const SEED: OrganismePECRecord[] = [
  {
    id: "org-pec-seed-1",
    intitule: "APES/ISAET",
    adresse: "Route de Mont Rolland/Thiès",
    telephone: "+221 781820203",
    email: "isaet@ucao.edu.sn",
    remarques: "",
    contactNom: "Abbé Albert SENE",
    contactTelephone: "+221 781820203",
    contactEmail: "tassene72@gmail.com",
  },
];

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): OrganismePECRecord[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    return JSON.parse(raw) as OrganismePECRecord[];
  } catch {
    return SEED;
  }
}

let store: OrganismePECRecord[] = load();

function persist() {
  // Nouvelle référence de tableau : useSyncExternalStore compare par Object.is
  // et ne re-rend pas si getOrganismesPEC() renvoie la même référence.
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeOrganismesPEC(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getOrganismesPEC(): OrganismePECRecord[] {
  return store;
}

export function getOrganismePECById(id: string): OrganismePECRecord | undefined {
  return store.find((o) => o.id === id);
}

export type OrganismePECPayload = Omit<OrganismePECRecord, "id">;

export function addOrganismePEC(payload: OrganismePECPayload): OrganismePECRecord {
  const record: OrganismePECRecord = {
    ...payload,
    id: `org-pec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  store.push(record);
  persist();
  return record;
}

export function updateOrganismePEC(id: string, payload: OrganismePECPayload): void {
  store = store.map((o) => (o.id === id ? { ...o, ...payload } : o));
  persist();
}

export function deleteOrganismePEC(id: string): void {
  store = store.filter((o) => o.id !== id);
  persist();
}

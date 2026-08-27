export interface TypeFraisRecord {
  id: string;
  code: string;
  intitule: string;
  remarques?: string;
}

export interface ModePaiementFinanceRecord {
  id: string;
  code: string;
  intitule: string;
}

export interface TypeFactureRecord {
  id: string;
  code: string;
  intitule: string;
  facturePedagogique: boolean;
}

function createListStore<T extends { id: string }>(storageKey: string, seed: T[]) {
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((fn) => fn());
  }

  function load(): T[] {
    if (typeof window === "undefined") return seed;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return seed;
      return JSON.parse(raw) as T[];
    } catch {
      return seed;
    }
  }

  let store: T[] = load();

  function persist() {
    // Nouvelle référence de tableau : useSyncExternalStore compare par
    // Object.is et ne re-rend pas si getAll() renvoie la même référence.
    store = store.slice();
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(store));
    }
    notify();
  }

  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getAll(): T[] {
      return store;
    },
    add(payload: Omit<T, "id">): T {
      const record = { ...payload, id: `${storageKey}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` } as T;
      store.push(record);
      persist();
      return record;
    },
    update(id: string, patch: Partial<Omit<T, "id">>) {
      const idx = store.findIndex((r) => r.id === id);
      if (idx < 0) return;
      store[idx] = { ...store[idx], ...patch };
      persist();
    },
    remove(id: string) {
      store = store.filter((r) => r.id !== id);
      persist();
    },
  };
}

const SEED_TYPES_FRAIS: TypeFraisRecord[] = [
  { id: "tf-seed-1", code: "APE", intitule: "Association des Parents d'Etudiants (APE)" },
  { id: "tf-seed-2", code: "AVU", intitule: "Avance uniforme" },
  { id: "tf-seed-3", code: "BDE", intitule: "Bureau des étudiants (BDE)" },
  { id: "tf-seed-4", code: "FG", intitule: "Frais généraux" },
];

const SEED_MODES_PAIEMENT: ModePaiementFinanceRecord[] = [
  { id: "mp-seed-1", code: "AVR", intitule: "AVOIR" },
  { id: "mp-seed-2", code: "CHQ", intitule: "Chèque" },
  { id: "mp-seed-3", code: "ESP", intitule: "Espèce" },
  { id: "mp-seed-4", code: "VIR", intitule: "Virement" },
];

const SEED_TYPES_FACTURE: TypeFactureRecord[] = [];

export const typeFraisStore = createListStore<TypeFraisRecord>("edumanage-fin-type-frais-v1", SEED_TYPES_FRAIS);
export const modePaiementFinanceStore = createListStore<ModePaiementFinanceRecord>(
  "edumanage-fin-mode-paiement-v1",
  SEED_MODES_PAIEMENT,
);
export const typeFactureStore = createListStore<TypeFactureRecord>("edumanage-fin-type-facture-v1", SEED_TYPES_FACTURE);

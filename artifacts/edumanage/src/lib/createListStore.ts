/** Fabrique de store générique pour une liste de paramétrage (code/intitulé + champs propres),
 * persistée en localStorage avec CRUD add/update/remove et souscription useSyncExternalStore. */
export function createListStore<T extends { id: string }>(storageKey: string, seed: T[]) {
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

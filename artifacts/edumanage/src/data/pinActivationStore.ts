const STORAGE_KEY = "edumanage-pin-activation-v1";

const DUREE_VALIDITE_MINUTES = 15;

export interface PinActivationRecord {
  id: string;
  userId: string;
  compteLabel: string;
  compteIdentifier: string;
  pin: string;
  createdAt: string;
  expiresAt: string;
  utilise: boolean;
  utiliseLe?: string;
}

export type StatutPin = "actif" | "utilise" | "expire";

/** Calculé à la lecture, jamais stocké — un PIN "expire" au fil du temps sans qu'aucune mutation
 * n'ait besoin de tourner en arrière-plan (même principe que statutDerogation). */
export function statutPin(record: PinActivationRecord): StatutPin {
  if (record.utilise) return "utilise";
  if (new Date(record.expiresAt).getTime() < Date.now()) return "expire";
  return "actif";
}

let store: PinActivationRecord[] = load();

function load(): PinActivationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PinActivationRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribePinActivation(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPinsActivation(): PinActivationRecord[] {
  return store;
}

function genererCode4Chiffres(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Génère un nouveau PIN pour un compte — le rend actif tout de suite ; les PIN précédents pour
 * ce même compte deviennent naturellement obsolètes (ils restent visibles dans le journal mais
 * verifierEtConsommerPin() ne retient toujours que celui-ci, jamais un plus ancien). */
export function genererPin(userId: string, compteLabel: string, compteIdentifier: string): PinActivationRecord {
  const now = new Date();
  const record: PinActivationRecord = {
    id: `pin-${Date.now()}`,
    userId,
    compteLabel,
    compteIdentifier,
    pin: genererCode4Chiffres(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DUREE_VALIDITE_MINUTES * 60 * 1000).toISOString(),
    utilise: false,
  };
  store = [record, ...store];
  persist();
  return record;
}

/** Vérifie le PIN saisi contre le plus récent PIN actif du compte (jamais un plus ancien, même
 * valide) et le consomme immédiatement s'il correspond — usage unique. */
export function verifierEtConsommerPin(userId: string, pin: string): boolean {
  const dernier = store.find((r) => r.userId === userId);
  if (!dernier || dernier.pin !== pin.trim() || statutPin(dernier) !== "actif") return false;
  dernier.utilise = true;
  dernier.utiliseLe = new Date().toISOString();
  persist();
  return true;
}

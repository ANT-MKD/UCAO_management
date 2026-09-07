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
  auteurId: string;
  auteurLabel: string;
  utilise: boolean;
  utiliseLe?: string;
  revoque?: boolean;
  revoqueLe?: string;
  revoquePar?: string;
}

export type StatutPin = "actif" | "utilise" | "expire" | "remplace" | "revoque";

/** Calculé à la lecture, jamais stocké. "remplace" reflète le fait que verifierEtConsommerPin() ne
 * retient jamais que le PIN le plus récent d'un compte — un plus ancien encore non expiré ne sert
 * déjà plus à rien, autant l'afficher honnêtement plutôt que "Actif". */
export function statutPin(record: PinActivationRecord, allRecords: PinActivationRecord[]): StatutPin {
  if (record.revoque) return "revoque";
  if (record.utilise) return "utilise";
  if (new Date(record.expiresAt).getTime() < Date.now()) return "expire";
  const plusRecent = allRecords.find((r) => r.userId === record.userId);
  if (plusRecent && plusRecent.id !== record.id) return "remplace";
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

/** Génère un nouveau PIN pour un compte, attribué à l'admin qui l'a créé — le rend actif tout de
 * suite ; les PIN précédents pour ce même compte deviennent naturellement obsolètes ("remplace"). */
export function genererPin(userId: string, compteLabel: string, compteIdentifier: string, auteurId: string, auteurLabel: string): PinActivationRecord {
  const now = new Date();
  const record: PinActivationRecord = {
    id: `pin-${Date.now()}`,
    userId,
    compteLabel,
    compteIdentifier,
    pin: genererCode4Chiffres(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DUREE_VALIDITE_MINUTES * 60 * 1000).toISOString(),
    auteurId,
    auteurLabel,
    utilise: false,
  };
  store = [record, ...store];
  persist();
  return record;
}

/** Annule un PIN avant qu'il soit utilisé — ex. envoyé par erreur, compte compromis. Ne modifie
 * jamais un PIN déjà consommé/expiré/remplacé : le journal reste un historique honnête. */
export function revoquerPin(id: string, actorLabel: string): void {
  const record = store.find((r) => r.id === id);
  if (!record) return;
  if (statutPin(record, store) !== "actif") {
    throw new Error("Seul un PIN actif peut être révoqué.");
  }
  record.revoque = true;
  record.revoqueLe = new Date().toISOString();
  record.revoquePar = actorLabel;
  persist();
}

/** Vérifie le PIN saisi contre le plus récent PIN du compte (jamais un plus ancien, même valide)
 * et le consomme immédiatement s'il correspond et est actif — usage unique. */
export function verifierEtConsommerPin(userId: string, pin: string): boolean {
  const dernier = store.find((r) => r.userId === userId);
  if (!dernier || dernier.pin !== pin.trim() || statutPin(dernier, store) !== "actif") return false;
  dernier.utilise = true;
  dernier.utiliseLe = new Date().toISOString();
  persist();
  return true;
}

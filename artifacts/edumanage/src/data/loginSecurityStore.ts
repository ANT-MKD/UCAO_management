const STORAGE_KEY = "edumanage-login-security-v1";

export const MAX_TENTATIVES = 5;
const DUREE_BLOCAGE_MINUTES = 15;

interface TentativeState {
  count: number;
  lockedUntil?: string;
}

type SecurityState = Record<string, TentativeState>;

function normalize(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function load(): SecurityState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SecurityState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

let store: SecurityState = load();

function persist() {
  store = { ...store };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

export interface LockStatus {
  locked: boolean;
  remainingMs?: number;
}

/** Blocage suivi par identifiant saisi (compte réel ou non) — c'est volontaire : si on ne bloquait
 * que les identifiants qui correspondent à un compte réel, un attaquant pourrait déduire quels
 * identifiants existent selon qu'un blocage se déclenche ou non. */
export function isLocked(identifier: string): LockStatus {
  const entry = store[normalize(identifier)];
  if (!entry?.lockedUntil) return { locked: false };
  const remainingMs = new Date(entry.lockedUntil).getTime() - Date.now();
  if (remainingMs <= 0) return { locked: false };
  return { locked: true, remainingMs };
}

export function registerFailedAttempt(identifier: string): LockStatus {
  const key = normalize(identifier);
  const entry = store[key] ?? { count: 0 };
  const nextCount = entry.count + 1;
  const next: TentativeState = { count: nextCount };
  if (nextCount >= MAX_TENTATIVES) {
    next.lockedUntil = new Date(Date.now() + DUREE_BLOCAGE_MINUTES * 60 * 1000).toISOString();
  } else if (entry.lockedUntil) {
    next.lockedUntil = entry.lockedUntil;
  }
  store = { ...store, [key]: next };
  persist();
  return isLocked(identifier);
}

export function registerSuccessfulLogin(identifier: string): void {
  const key = normalize(identifier);
  if (!store[key]) return;
  const next = { ...store };
  delete next[key];
  store = next;
  persist();
}

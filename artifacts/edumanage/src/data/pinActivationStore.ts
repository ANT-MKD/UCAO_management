import { ecrireStockage } from "@/lib/stockageLocal";
const STORAGE_KEY = "edumanage-pin-activation-v1";
const DEMANDES_STORAGE_KEY = "edumanage-demandes-reinit-v1";

/** Le code est remis en main propre par l'administration : il doit rester valable le temps de
 * rentrer chez soi. La sécurité repose sur sa longueur (6 chiffres) et sur la limite d'essais. */
const DUREE_VALIDITE_MINUTES = 24 * 60;
const MAX_ESSAIS_PIN = 5;

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
  /** Essais erronés sur ce code — au-delà de MAX_ESSAIS_PIN il est révoqué automatiquement. */
  essaisEchoues?: number;
}

/** Demande « mot de passe oublié » faite depuis la page de connexion : elle n'envoie jamais de code
 * elle-même, elle prévient l'administration, qui remet un code PIN après vérification d'identité. */
export interface DemandeReinitialisationRecord {
  id: string;
  userId: string;
  compteLabel: string;
  compteIdentifier: string;
  createdAt: string;
  traiteeLe?: string;
  traitePar?: string;
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
let demandes: DemandeReinitialisationRecord[] = loadDemandes();

function loadDemandes(): DemandeReinitialisationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(DEMANDES_STORAGE_KEY) ?? "[]") as DemandeReinitialisationRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
  demandes = demandes.slice();
  if (typeof window !== "undefined") {
    ecrireStockage(STORAGE_KEY, JSON.stringify(store));
    ecrireStockage(DEMANDES_STORAGE_KEY, JSON.stringify(demandes));
  }
  notify();
}

export function getDemandesReinitialisation(): DemandeReinitialisationRecord[] {
  return demandes;
}

/** Enregistre une demande en attente pour ce compte. Renvoie false si une demande est déjà en
 * attente (pas de doublon ni de nouvelle alerte à chaque clic). */
export function signalerDemandeReinitialisation(userId: string, compteLabel: string, compteIdentifier: string): boolean {
  if (demandes.some((d) => d.userId === userId && !d.traiteeLe)) return false;
  demandes = [
    { id: `dreinit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, userId, compteLabel, compteIdentifier, createdAt: new Date().toISOString() },
    ...demandes,
  ];
  persist();
  return true;
}

export function subscribePinActivation(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPinsActivation(): PinActivationRecord[] {
  return store;
}

function genererCode6Chiffres(): string {
  const tableau = new Uint32Array(1);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(tableau);
  else tableau[0] = Math.floor(Math.random() * 2 ** 32);
  return String(100000 + (tableau[0] % 900000));
}

/** Génère un nouveau PIN pour un compte, attribué à l'admin qui l'a créé — le rend actif tout de
 * suite ; les PIN précédents pour ce même compte deviennent naturellement obsolètes ("remplace"). */
export function genererPin(userId: string, compteLabel: string, compteIdentifier: string, auteurId: string, auteurLabel: string): PinActivationRecord {
  const now = new Date();
  const record: PinActivationRecord = {
    id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    compteLabel,
    compteIdentifier,
    pin: genererCode6Chiffres(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DUREE_VALIDITE_MINUTES * 60 * 1000).toISOString(),
    auteurId,
    auteurLabel,
    utilise: false,
  };
  store = [record, ...store];
  // Un code remis règle les demandes « mot de passe oublié » en attente pour ce compte.
  const maintenant = now.toISOString();
  demandes = demandes.map((d) => (d.userId === userId && !d.traiteeLe ? { ...d, traiteeLe: maintenant, traitePar: auteurLabel } : d));
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
  if (!dernier || statutPin(dernier, store) !== "actif") return false;
  if (dernier.pin !== pin.trim()) {
    // Limite d'essais : un code deviné par essais successifs est révoqué avant d'être trouvé.
    dernier.essaisEchoues = (dernier.essaisEchoues ?? 0) + 1;
    if (dernier.essaisEchoues >= MAX_ESSAIS_PIN) {
      dernier.revoque = true;
      dernier.revoqueLe = new Date().toISOString();
      dernier.revoquePar = `Système — ${MAX_ESSAIS_PIN} essais erronés`;
    }
    persist();
    return false;
  }
  dernier.utilise = true;
  dernier.utiliseLe = new Date().toISOString();
  persist();
  return true;
}

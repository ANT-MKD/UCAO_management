import { emettreQuittanceBrute, cancelQuittanceEmise } from "./studentStore";

const STORAGE_KEY = "edumanage-frais-etudiant-v1";

export interface FraisEtudiantLigne {
  id: string;
  etudiantId: string;
  annee: string;
  typeFraisId: string;
  montant: number;
  dateLimite?: string;
  obligatoire: boolean;
  echeance: boolean;
  nbEcheances?: number;
  ajouteLe: string;
  quittanceId?: string;
  quittanceDate?: string;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): FraisEtudiantLigne[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FraisEtudiantLigne[];
  } catch {
    return [];
  }
}

let store: FraisEtudiantLigne[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeFraisEtudiant(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getFraisEtudiant(): FraisEtudiantLigne[] {
  return store;
}

export interface NouvelleLigneFraisEtudiant {
  typeFraisId: string;
  montant: number;
  dateLimite?: string;
  obligatoire: boolean;
  echeance: boolean;
  nbEcheances?: number;
}

/** Ajoute une ou plusieurs lignes de frais pour un étudiant. Si quittancerImmediatement est vrai, elles sont
 * aussitôt transformées en une quittance réelle (solde dû augmenté) ; sinon elles restent "non quittancées". */
export function ajouterFraisEtudiant(
  etudiantId: string,
  annee: string,
  lignes: NouvelleLigneFraisEtudiant[],
  quittancerImmediatement: boolean,
  typeFraisLabel: (typeFraisId: string) => string,
): FraisEtudiantLigne[] {
  const date = new Date().toISOString().slice(0, 10);
  const created: FraisEtudiantLigne[] = lignes.map((l) => ({
    id: `fe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    etudiantId,
    annee,
    typeFraisId: l.typeFraisId,
    montant: l.montant,
    dateLimite: l.dateLimite,
    obligatoire: l.obligatoire,
    echeance: l.echeance,
    nbEcheances: l.nbEcheances,
    ajouteLe: date,
  }));

  store = [...created, ...store];
  persist();

  if (quittancerImmediatement) {
    const quittance = emettreQuittanceBrute({
      etudiantId,
      date,
      lignes: created.map((l) => ({ label: typeFraisLabel(l.typeFraisId), montant: l.montant })),
      reference: `Frais étudiant (${created.length} ligne(s))`,
    });
    store = store.map((l) => (created.some((c) => c.id === l.id) ? { ...l, quittanceId: quittance.id, quittanceDate: date } : l));
    persist();
  }

  return created;
}

export function supprimerFraisEtudiant(id: string): void {
  store = store.filter((l) => l.id !== id || !!l.quittanceId);
  persist();
}

/** Annule un frais déjà quittancé : restaure le solde dû de l'étudiant via cancelQuittanceEmise. */
export function annulerFraisEtudiantQuittance(id: string): { ok: boolean; reason?: string } {
  const ligne = store.find((l) => l.id === id);
  if (!ligne) return { ok: false, reason: "Frais introuvable." };
  if (!ligne.quittanceId) return { ok: false, reason: "Ce frais n'est pas encore quittancé." };
  cancelQuittanceEmise(ligne.quittanceId);
  return { ok: true };
}

/** Convertit une ligne "non quittancée" en une vraie quittance (le solde dû de l'étudiant augmente). */
export function quittancerFraisEtudiant(id: string, typeFraisLabel: (typeFraisId: string) => string): { ok: boolean; reason?: string } {
  const ligne = store.find((l) => l.id === id);
  if (!ligne) return { ok: false, reason: "Frais introuvable." };
  if (ligne.quittanceId) return { ok: false, reason: "Ce frais est déjà quittancé." };

  const date = new Date().toISOString().slice(0, 10);
  const quittance = emettreQuittanceBrute({
    etudiantId: ligne.etudiantId,
    date,
    dateLimite: ligne.dateLimite,
    lignes: [{ label: typeFraisLabel(ligne.typeFraisId), montant: ligne.montant }],
    reference: `Frais étudiant`,
  });
  store = store.map((l) => (l.id === id ? { ...l, quittanceId: quittance.id, quittanceDate: date } : l));
  persist();
  return { ok: true };
}

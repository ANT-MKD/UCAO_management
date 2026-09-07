import { ajouterFraisEtudiant } from "./fraisEtudiantStore";

const STORAGE_KEY = "edumanage-reprise-frais-v1";

export type StatutReprise = "en_attente" | "valide" | "rejete";

export interface ReprisFraisLigne {
  id: string;
  ancienCode: string;
  nom: string;
  prenom: string;
  libelleAnneeScolaire: string;
  montant: number;
  etudiantId?: string;
  statut: StatutReprise;
  importeLe: string;
  motifRejet?: string;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): ReprisFraisLigne[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ReprisFraisLigne[];
  } catch {
    return [];
  }
}

let store: ReprisFraisLigne[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeReprisFrais(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getReprisFrais(): ReprisFraisLigne[] {
  return store;
}

/** Codes déjà importés (quel que soit leur statut) — utilisé pour avertir d'un ré-import du même fichier. */
export function getAncienCodesDejaImportes(): Set<string> {
  return new Set(store.map((l) => l.ancienCode));
}

export interface NouvelleReprisLigne {
  ancienCode: string;
  nom: string;
  prenom: string;
  libelleAnneeScolaire: string;
  montant: number;
  etudiantId?: string;
}

/** Importe un lot de lignes de reprise, chacune "en attente" — n'a aucun effet sur le solde des étudiants
 * tant qu'elles ne sont pas validées individuellement. */
export function importerReprisFrais(lignes: NouvelleReprisLigne[]): ReprisFraisLigne[] {
  const date = new Date().toISOString().slice(0, 10);
  const created: ReprisFraisLigne[] = lignes.map((l) => ({
    id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ancienCode: l.ancienCode,
    nom: l.nom,
    prenom: l.prenom,
    libelleAnneeScolaire: l.libelleAnneeScolaire,
    montant: l.montant,
    etudiantId: l.etudiantId,
    statut: "en_attente",
    importeLe: date,
  }));
  store = [...created, ...store];
  persist();
  return created;
}

/** Associe (ou change) manuellement l'étudiant retrouvé pour une ligne non associée automatiquement. */
export function associerEtudiantReprise(id: string, etudiantId: string): void {
  store = store.map((l) => (l.id === id ? { ...l, etudiantId } : l));
  persist();
}

/** Valide une reprise : crée un frais étudiant réel (quittancé immédiatement) pour le montant repris. */
export function validerReprisFrais(
  id: string,
  typeFraisId: string,
  typeFraisLabel: (typeFraisId: string) => string,
): { ok: boolean; reason?: string } {
  const ligne = store.find((l) => l.id === id);
  if (!ligne) return { ok: false, reason: "Ligne introuvable." };
  if (ligne.statut !== "en_attente") return { ok: false, reason: "Cette ligne a déjà été traitée." };
  if (!ligne.etudiantId) return { ok: false, reason: "Associez d'abord un étudiant avant de valider." };

  ajouterFraisEtudiant(
    ligne.etudiantId,
    ligne.libelleAnneeScolaire,
    [{ typeFraisId, montant: ligne.montant, obligatoire: true, echeance: false }],
    true,
    typeFraisLabel,
  );
  store = store.map((l) => (l.id === id ? { ...l, statut: "valide" } : l));
  persist();
  return { ok: true };
}

/** Valide toutes les lignes "en attente" déjà associées à un étudiant, parmi la liste fournie. Ignore les autres. */
export function validerReprisFraisMasse(
  ids: string[],
  typeFraisId: string,
  typeFraisLabel: (typeFraisId: string) => string,
): number {
  let nb = 0;
  for (const id of ids) {
    const result = validerReprisFrais(id, typeFraisId, typeFraisLabel);
    if (result.ok) nb++;
  }
  return nb;
}

export function rejeterReprisFrais(id: string, motif: string): { ok: boolean; reason?: string } {
  const ligne = store.find((l) => l.id === id);
  if (!ligne) return { ok: false, reason: "Ligne introuvable." };
  if (ligne.statut !== "en_attente") return { ok: false, reason: "Cette ligne a déjà été traitée." };
  store = store.map((l) => (l.id === id ? { ...l, statut: "rejete", motifRejet: motif } : l));
  persist();
  return { ok: true };
}

import { emettreQuittanceBrute, cancelQuittanceEmise, type PaiementRecord } from "./studentStore";

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
  annulee: boolean;
  motifAnnulation?: string;
}

export type StatutFraisEtudiant = "en_attente" | "quittance" | "annule";

/** Statut réel d'une ligne : annulee est la source de vérité pour une annulation faite depuis ces écrans,
 * mais on retombe aussi sur le statut de la quittance sous-jacente si elle a été annulée ailleurs (ex. depuis
 * la fiche paiement), pour ne jamais désynchroniser l'affichage. */
export function statutFraisEtudiant(l: FraisEtudiantLigne, paiements: PaiementRecord[]): StatutFraisEtudiant {
  if (l.annulee) return "annule";
  if (!l.quittanceId) return "en_attente";
  const p = paiements.find((pp) => pp.id === l.quittanceId);
  if (p?.statut === "annule") return "annule";
  return "quittance";
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
    return (JSON.parse(raw) as FraisEtudiantLigne[]).map((l) => ({ ...l, annulee: l.annulee ?? false }));
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

/** Lignes actives (non annulées) pour un étudiant/année/type — utilisé pour avertir d'un doublon avant ajout. */
export function getLignesActivesPour(etudiantId: string, annee: string, typeFraisId: string): FraisEtudiantLigne[] {
  return store.filter((l) => l.etudiantId === etudiantId && l.annee === annee && l.typeFraisId === typeFraisId && !l.annulee);
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
    annulee: false,
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

/** Applique les mêmes lignes de frais à plusieurs étudiants (ajout en masse). Renvoie le nombre d'étudiants traités. */
export function ajouterFraisEtudiantMasse(
  etudiantIds: string[],
  annee: string,
  lignes: NouvelleLigneFraisEtudiant[],
  quittancerImmediatement: boolean,
  typeFraisLabel: (typeFraisId: string) => string,
): number {
  etudiantIds.forEach((etudiantId) => {
    ajouterFraisEtudiant(etudiantId, annee, lignes, quittancerImmediatement, typeFraisLabel);
  });
  return etudiantIds.length;
}

/** Supprime (si non quittancées) ou annule (si déjà quittancées) une liste précise de lignes, avec un motif
 * commun. Utilisé par la suppression en masse, une fois que la page a résolu quelles lignes sont concernées. */
export function traiterFraisEtudiantMasse(ligneIds: string[], motif: string): { supprimes: number; annules: number } {
  let supprimes = 0;
  let annules = 0;
  for (const id of ligneIds) {
    const ligne = store.find((l) => l.id === id);
    if (!ligne || ligne.annulee) continue;
    if (!ligne.quittanceId) {
      supprimerFraisEtudiant(id, motif);
      supprimes++;
    } else {
      const result = annulerFraisEtudiantQuittance(id, motif);
      if (result.ok) annules++;
    }
  }
  return { supprimes, annules };
}

/** Annule (sans effet financier) une ligne encore non quittancée. Ne l'efface jamais : gardée pour l'audit,
 * avec son motif, comme tous les autres documents financiers de l'app. */
export function supprimerFraisEtudiant(id: string, motif?: string): void {
  store = store.map((l) => (l.id === id ? { ...l, annulee: true, motifAnnulation: motif } : l));
  persist();
}

/** Annule un frais déjà quittancé : restaure le solde dû de l'étudiant via cancelQuittanceEmise. */
export function annulerFraisEtudiantQuittance(id: string, motif?: string): { ok: boolean; reason?: string } {
  const ligne = store.find((l) => l.id === id);
  if (!ligne) return { ok: false, reason: "Frais introuvable." };
  if (!ligne.quittanceId) return { ok: false, reason: "Ce frais n'est pas encore quittancé." };
  if (ligne.annulee) return { ok: false, reason: "Ce frais est déjà annulé." };
  cancelQuittanceEmise(ligne.quittanceId);
  store = store.map((l) => (l.id === id ? { ...l, annulee: true, motifAnnulation: motif } : l));
  persist();
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

import type { NiveauMethodeCalcul } from "@/lib/bulletinCalculs";

const STORAGE_KEY = "edumanage-mentions-store-v1";

export interface MentionRecord {
  id: string;
  /** Niveau de moyenne auquel s'applique cette tranche (UE, session, année, programme) — chaque
   * niveau peut avoir son propre barème de mentions. */
  niveau: NiveauMethodeCalcul;
  valeurMin: number;
  valeurMax: number;
  mention: string;
  /** Texte imprimé sur le bulletin quand la moyenne tombe dans cette tranche ET que l'élément
   * est validé (admis/passage). */
  appreciationSucces?: string;
  /** Texte imprimé quand la moyenne tombe dans cette tranche mais que l'élément n'est pas validé. */
  appreciationEchec?: string;
  actif: boolean;
}

interface BandeDefaut {
  min: number;
  max: number;
  mention: string;
  succes?: string;
  echec?: string;
}

const BANDES_DEFAUT: BandeDefaut[] = [
  { min: 16, max: 20, mention: "Très Bien", succes: "Excellent travail, félicitations du jury." },
  { min: 14, max: 16, mention: "Bien", succes: "Très bon travail, continuez ainsi." },
  { min: 12, max: 14, mention: "Assez Bien", succes: "Bon travail, des marges de progression existent." },
  { min: 10, max: 12, mention: "Passable", succes: "Résultat suffisant pour valider." },
  { min: 0, max: 10, mention: "Ajourné", echec: "Résultats insuffisants, encouragements à persévérer." },
];

function seedForNiveau(niveau: NiveauMethodeCalcul): MentionRecord[] {
  return BANDES_DEFAUT.map((b, i) => ({
    id: `mention-${niveau}-${i}`,
    niveau,
    valeurMin: b.min,
    valeurMax: b.max,
    mention: b.mention,
    appreciationSucces: b.succes,
    appreciationEchec: b.echec,
    actif: true,
  }));
}

function seed(): MentionRecord[] {
  const niveaux: NiveauMethodeCalcul[] = ["moyenneUe", "moyenneSession", "moyenneAnnee", "moyenneProgramme"];
  return niveaux.flatMap(seedForNiveau);
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function load(): MentionRecord[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as MentionRecord[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seed();
  } catch {
    return seed();
  }
}

let store: MentionRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeMentions(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getMentions(): MentionRecord[] {
  return store;
}

export function getMentionsParNiveau(niveau: NiveauMethodeCalcul): MentionRecord[] {
  return store.filter((m) => m.niveau === niveau);
}

export interface MentionPayload {
  niveau: NiveauMethodeCalcul;
  valeurMin: number;
  valeurMax: number;
  mention: string;
  appreciationSucces?: string;
  appreciationEchec?: string;
  actif: boolean;
}

export function upsertMention(payload: MentionPayload, id?: string): MentionRecord {
  const existing = id ? store.find((m) => m.id === id) : undefined;
  if (existing) {
    Object.assign(existing, payload);
    persist();
    return existing;
  }
  const record: MentionRecord = { id: `mention-${Date.now()}`, ...payload };
  store.unshift(record);
  persist();
  return record;
}

export function deleteMention(id: string): void {
  store = store.filter((m) => m.id !== id);
  persist();
}

export interface MentionResultat {
  mention?: string;
  appreciation?: string;
}

/** Résout la mention + appréciation réellement imprimées pour une moyenne, à partir des tranches
 * configurées pour le niveau — retombe sur les seuils classiques français si rien n'est actif
 * pour ce niveau (aucune tranche perdue silencieusement). */
export function resoudreMention(niveau: NiveauMethodeCalcul, moyenne: number, valide: boolean): MentionResultat {
  const bandes = store.filter((m) => m.niveau === niveau && m.actif);
  const bande = bandes.find((b) => moyenne >= b.valeurMin && moyenne < b.valeurMax) ?? bandes.find((b) => moyenne >= b.valeurMin && moyenne <= b.valeurMax);
  if (!bande) {
    return { mention: moyenne >= 10 ? "Passable" : "Ajourné" };
  }
  return { mention: bande.mention, appreciation: valide ? bande.appreciationSucces : bande.appreciationEchec };
}
